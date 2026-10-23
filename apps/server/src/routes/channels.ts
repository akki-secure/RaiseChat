import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// GET /api/workspaces/:wid/channels
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { wid } = req.params;

    const result = await pool.query(
      `SELECT c.id, c.name, c.type, c.created_by, c.created_at,
              cm.joined_at, cm.last_read_at,
              (SELECT COUNT(*) FROM messages m
               WHERE m.channel_id = c.id AND m.deleted_at IS NULL
               AND m.parent_id IS NULL AND m.created_at > cm.last_read_at) AS unread_count
       FROM channels c
       LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $2
       WHERE c.workspace_id = $1
         AND (c.type = 'public' OR cm.user_id IS NOT NULL)
       ORDER BY c.created_at ASC`,
      [wid, userId]
    );
    res.json({ channels: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/workspaces/:wid/channels — チャンネル作成
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, type } = z.object({
      name: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/),
      type: z.enum(['public', 'private']),
    }).parse(req.body);
    const userId = req.user!.userId;
    const { wid } = req.params;

    const member = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [wid, userId]
    );
    if (!member.rows[0]) {
      res.status(403).json({ error: 'ワークスペースのメンバーではありません' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO channels (workspace_id, name, type, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
        [wid, name, type, userId]
      );
      const channel = result.rows[0];
      await client.query(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
        [channel.id, userId]
      );
      await client.query('COMMIT');
      res.status(201).json({ channel });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/workspaces/:wid/channels/:cid — チャンネル削除 (owner only)
router.delete('/:cid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { wid, cid } = req.params;
    const userId = req.user!.userId;

    const member = await pool.query(
      "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
      [wid, userId]
    );
    if (member.rows[0]?.role !== 'owner') {
      res.status(403).json({ error: '権限がありません' });
      return;
    }

    const ch = await pool.query('SELECT name FROM channels WHERE id = $1', [cid]);
    if (ch.rows[0]?.name === 'general') {
      res.status(400).json({ error: '#general チャンネルは削除できません' });
      return;
    }

    await pool.query('DELETE FROM channels WHERE id = $1 AND workspace_id = $2', [cid, wid]);
    res.json({ message: 'チャンネルを削除しました' });
  } catch (err) {
    next(err);
  }
});

// POST /api/workspaces/:wid/channels/:cid/join — パブリックチャンネルに参加
router.post('/:cid/join', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { wid, cid } = req.params;
    const userId = req.user!.userId;

    const ch = await pool.query(
      'SELECT type FROM channels WHERE id = $1 AND workspace_id = $2',
      [cid, wid]
    );
    if (!ch.rows[0]) {
      res.status(404).json({ error: 'チャンネルが見つかりません' });
      return;
    }
    if (ch.rows[0].type === 'private') {
      res.status(403).json({ error: 'プライベートチャンネルには招待が必要です' });
      return;
    }

    await pool.query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [cid, userId]
    );
    res.json({ message: 'チャンネルに参加しました' });
  } catch (err) {
    next(err);
  }
});

// POST /api/workspaces/:wid/channels/:cid/invite — プライベートチャンネルに招待
router.post('/:cid/invite', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cid, wid } = req.params;
    const { user_id } = z.object({ user_id: z.string().uuid() }).parse(req.body);
    const requesterId = req.user!.userId;

    const requesterMember = await pool.query(
      'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [cid, requesterId]
    );
    if (!requesterMember.rows[0]) {
      res.status(403).json({ error: 'このチャンネルのメンバーではありません' });
      return;
    }

    const wsMember = await pool.query(
      'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [wid, user_id]
    );
    if (!wsMember.rows[0]) {
      res.status(404).json({ error: 'ワークスペースのメンバーではありません' });
      return;
    }

    await pool.query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [cid, user_id]
    );
    res.json({ message: 'チャンネルに招待しました' });
  } catch (err) {
    next(err);
  }
});

export default router;
