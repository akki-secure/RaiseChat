import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/workspaces — 自分が所属するワークスペース一覧
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT w.id, w.name, w.owner_id, w.invite_code, w.created_at, wm.role
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
       ORDER BY w.created_at ASC`,
      [req.user!.userId]
    );
    res.json({ workspaces: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/workspaces — ワークスペース作成
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);
    const userId = req.user!.userId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const wsResult = await client.query(
        'INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING *',
        [name, userId]
      );
      const ws = wsResult.rows[0];
      await client.query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
        [ws.id, userId]
      );
      // デフォルトで #general チャンネルを作成
      const chResult = await client.query(
        "INSERT INTO channels (workspace_id, name, type, created_by) VALUES ($1, 'general', 'public', $2) RETURNING id",
        [ws.id, userId]
      );
      await client.query(
        "INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)",
        [chResult.rows[0].id, userId]
      );
      await client.query('COMMIT');
      res.status(201).json({ workspace: ws });
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

// GET /api/workspaces/:id/join?code=xxx — 招待コードで参加
router.get('/:id/join', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().min(1) }).parse(req.query);
    const userId = req.user!.userId;

    const wsResult = await pool.query(
      'SELECT id FROM workspaces WHERE id = $1 AND invite_code = $2',
      [req.params.id, code]
    );
    if (wsResult.rows.length === 0) {
      res.status(404).json({ error: '招待コードが無効です' });
      return;
    }

    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [req.params.id, userId]
    );
    res.json({ message: 'ワークスペースに参加しました' });
  } catch (err) {
    next(err);
  }
});

// POST /api/workspaces/:id/invite — 招待コード再生成 (owner only)
router.post('/:id/invite', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const member = await pool.query(
      "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
      [req.params.id, userId]
    );
    if (member.rows[0]?.role !== 'owner') {
      res.status(403).json({ error: '権限がありません' });
      return;
    }

    const result = await pool.query(
      "UPDATE workspaces SET invite_code = encode(gen_random_bytes(16), 'hex') WHERE id = $1 RETURNING invite_code",
      [req.params.id]
    );
    res.json({ invite_code: result.rows[0].invite_code });
  } catch (err) {
    next(err);
  }
});

// GET /api/workspaces/:id/members — メンバー一覧
router.get('/:id/members', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const isMember = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (isMember.rows.length === 0) {
      res.status(403).json({ error: 'このワークスペースのメンバーではありません' });
      return;
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, wm.role
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY u.username ASC`,
      [req.params.id]
    );
    res.json({ members: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/workspaces/:id/members/:uid — 特定メンバー情報
router.get('/:id/members/:uid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const isMember = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (isMember.rows.length === 0) {
      res.status(403).json({ error: 'このワークスペースのメンバーではありません' });
      return;
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status
       FROM users u
       JOIN workspace_members wm ON wm.user_id = u.id
       WHERE wm.workspace_id = $1 AND u.id = $2`,
      [req.params.id, req.params.uid]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/workspaces/:id/search?q=... — ワークスペース横断全文検索
router.get('/:id/search', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { q } = z.object({ q: z.string().min(1).max(200) }).parse(req.query);

    const isMember = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (isMember.rows.length === 0) {
      res.status(403).json({ error: 'このワークスペースのメンバーではありません' });
      return;
    }

    const result = await pool.query(
      `SELECT m.id, m.channel_id, m.user_id, m.content, m.created_at,
              u.username, u.display_name, u.avatar_url
       FROM messages m
       JOIN channels c ON c.id = m.channel_id
       JOIN users u ON u.id = m.user_id
       WHERE c.workspace_id = $1
         AND m.deleted_at IS NULL
         AND m.parent_id IS NULL
         AND to_tsvector('english', m.content) @@ plainto_tsquery('english', $2)
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [req.params.id, q]
    );
    res.json({
      messages: result.rows.map((r: Record<string, unknown>) => ({
        ...r,
        user: { username: r.username, display_name: r.display_name, avatar_url: r.avatar_url },
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/workspaces/join — 招待コードで参加（コードのみで参加）
router.post('/join', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { invite_code } = z.object({ invite_code: z.string().min(1) }).parse(req.body);
    const userId = req.user!.userId;

    const wsResult = await pool.query(
      'SELECT id, name, owner_id, invite_code FROM workspaces WHERE invite_code = $1',
      [invite_code]
    );
    if (wsResult.rows.length === 0) {
      res.status(404).json({ error: '招待コードが無効です' });
      return;
    }

    const ws = wsResult.rows[0];
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [ws.id, userId]
    );
    res.json({ workspace: ws });
  } catch (err) {
    next(err);
  }
});

// POST /api/workspaces/:id/kick — ユーザーキック (owner only)
router.post('/:id/kick', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { user_id } = z.object({ user_id: z.string().uuid() }).parse(req.body);
    const requesterId = req.user!.userId;

    const member = await pool.query(
      "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
      [req.params.id, requesterId]
    );
    if (member.rows[0]?.role !== 'owner') {
      res.status(403).json({ error: '権限がありません' });
      return;
    }
    if (user_id === requesterId) {
      res.status(400).json({ error: '自分自身をキックできません' });
      return;
    }

    await pool.query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [req.params.id, user_id]
    );
    res.json({ message: 'ユーザーをキックしました' });
  } catch (err) {
    next(err);
  }
});

export default router;
