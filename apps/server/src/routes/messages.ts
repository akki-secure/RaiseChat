import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getIo } from '../socket/ioInstance.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// チャンネルメンバー確認ヘルパー
async function assertChannelMember(channelId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
    [channelId, userId]
  );
  return result.rows.length > 0;
}

// GET /api/channels/:cid/messages — メッセージ一覧 (cursor pagination)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cid } = req.params;
    const userId = req.user!.userId;
    const { before, limit = '50' } = req.query;

    if (!(await assertChannelMember(cid, userId))) {
      res.status(403).json({ error: 'このチャンネルのメンバーではありません' });
      return;
    }

    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    // $1=userId, $2=cid, $3=limitNum, $4=before(optional)
    const params: unknown[] = [userId, cid, limitNum];
    let cursor = '';
    if (before) {
      cursor = 'AND m.created_at < $4';
      params.push(before);
    }

    const result = await pool.query(
      `SELECT m.id, m.channel_id, m.user_id, m.content, m.parent_id,
              m.edited_at, m.created_at,
              u.username, u.display_name, u.avatar_url,
              (SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id AND r.deleted_at IS NULL) AS reply_count,
              (SELECT json_agg(json_build_object(
                'emoji', sub.emoji,
                'count', sub.cnt,
                'reacted', EXISTS(SELECT 1 FROM reactions rx WHERE rx.message_id = m.id AND rx.emoji = sub.emoji AND rx.user_id = $1)
              )) FROM (
                SELECT rr.emoji, COUNT(rr.id) AS cnt
                FROM reactions rr WHERE rr.message_id = m.id GROUP BY rr.emoji
              ) sub) AS reactions,
              (SELECT json_agg(json_build_object('url', a.url, 'file_type', a.file_type, 'size', a.size))
               FROM attachments a WHERE a.message_id = m.id) AS attachments
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $2 AND m.deleted_at IS NULL AND m.parent_id IS NULL
       ${cursor}
       ORDER BY m.created_at DESC
       LIMIT $3`,
      params
    );

    // last_read_at を更新
    await pool.query(
      'UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2',
      [cid, userId]
    );

    res.json({ messages: result.rows.reverse() });
  } catch (err) {
    next(err);
  }
});

// POST /api/channels/:cid/messages — メッセージ送信
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cid } = req.params;
    const userId = req.user!.userId;
    const { content, parent_id } = z.object({
      content: z.string().min(1).max(4000),
      parent_id: z.string().uuid().optional(),
    }).parse(req.body);

    if (!(await assertChannelMember(cid, userId))) {
      res.status(403).json({ error: 'このチャンネルのメンバーではありません' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO messages (channel_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, channel_id, user_id, content, parent_id, edited_at, created_at`,
      [cid, userId, content, parent_id ?? null]
    );

    const userResult = await pool.query(
      'SELECT username, display_name, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    const message = { ...result.rows[0], ...userResult.rows[0] };

    try {
      getIo().to(`channel:${cid}`).emit('message:new', message);
    } catch {
      // Socket.io 未初期化時は無視（テスト環境など）
    }

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

// GET /api/channels/:cid/messages/search — 全文検索
router.get('/search', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cid } = req.params;
    const userId = req.user!.userId;
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);

    if (!(await assertChannelMember(cid, userId))) {
      res.status(403).json({ error: 'このチャンネルのメンバーではありません' });
      return;
    }

    const result = await pool.query(
      `SELECT m.id, m.content, m.created_at, u.username, u.display_name, u.avatar_url
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $1
         AND m.deleted_at IS NULL
         AND to_tsvector('english', m.content) @@ plainto_tsquery('english', $2)
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [cid, q]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/messages/:mid/thread — スレッド返信一覧
router.get('/:mid/thread', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mid } = req.params;
    const userId = req.user!.userId;

    const parent = await pool.query(
      'SELECT channel_id FROM messages WHERE id = $1 AND deleted_at IS NULL',
      [mid]
    );
    if (!parent.rows[0]) {
      res.status(404).json({ error: 'メッセージが見つかりません' });
      return;
    }
    if (!(await assertChannelMember(parent.rows[0].channel_id, userId))) {
      res.status(403).json({ error: '権限がありません' });
      return;
    }

    const result = await pool.query(
      `SELECT m.id, m.content, m.user_id, m.edited_at, m.created_at,
              u.username, u.display_name, u.avatar_url
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.parent_id = $1 AND m.deleted_at IS NULL
       ORDER BY m.created_at ASC`,
      [mid]
    );
    res.json({ replies: result.rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/messages/:mid — メッセージ編集 (本人のみ)
router.put('/:mid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mid } = req.params;
    const userId = req.user!.userId;
    const { content } = z.object({ content: z.string().min(1).max(4000) }).parse(req.body);

    const result = await pool.query(
      `UPDATE messages SET content = $1, edited_at = NOW()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
       RETURNING id, content, edited_at`,
      [content, mid, userId]
    );
    if (result.rows.length === 0) {
      res.status(403).json({ error: '編集できません' });
      return;
    }
    res.json({ message: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/messages/:mid — 論理削除 (本人 or ワークスペースowner)
router.delete('/:mid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mid } = req.params;
    const userId = req.user!.userId;

    const msg = await pool.query(
      `SELECT m.user_id, m.channel_id, wm.role
       FROM messages m
       JOIN channels c ON c.id = m.channel_id
       JOIN workspace_members wm ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
       WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [mid, userId]
    );
    if (!msg.rows[0]) {
      res.status(404).json({ error: 'メッセージが見つかりません' });
      return;
    }
    const { user_id, role } = msg.rows[0];
    if (user_id !== userId && role !== 'owner') {
      res.status(403).json({ error: '削除できません' });
      return;
    }

    await pool.query(
      "UPDATE messages SET deleted_at = NOW() WHERE id = $1",
      [mid]
    );
    res.json({ message: '削除しました' });
  } catch (err) {
    next(err);
  }
});

export default router;
