import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// GET /api/workspaces/:wid/dms/:uid — DM一覧
router.get('/:uid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { wid, uid } = req.params;
    const userId = req.user!.userId;
    const { before, limit = '50' } = req.query;

    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const params: unknown[] = [wid, userId, uid, limitNum];
    let cursor = '';
    if (before) {
      cursor = 'AND dm.created_at < $5';
      params.push(before);
    }

    const result = await pool.query(
      `SELECT dm.id, dm.sender_id, dm.receiver_id, dm.content, dm.read_at, dm.created_at,
              u.username, u.display_name, u.avatar_url
       FROM direct_messages dm
       JOIN users u ON u.id = dm.sender_id
       WHERE dm.workspace_id = $1
         AND ((dm.sender_id = $2 AND dm.receiver_id = $3)
           OR (dm.sender_id = $3 AND dm.receiver_id = $2))
       ${cursor}
       ORDER BY dm.created_at DESC
       LIMIT $4`,
      params
    );

    // 未読を既読にする
    await pool.query(
      'UPDATE direct_messages SET read_at = NOW() WHERE workspace_id = $1 AND sender_id = $2 AND receiver_id = $3 AND read_at IS NULL',
      [wid, uid, userId]
    );

    res.json({ messages: result.rows.reverse() });
  } catch (err) {
    next(err);
  }
});

// POST /api/workspaces/:wid/dms/:uid — DM送信
router.post('/:uid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { wid, uid } = req.params;
    const userId = req.user!.userId;
    const { content } = z.object({ content: z.string().min(1).max(4000) }).parse(req.body);

    const wsMember = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [wid, uid]
    );
    if (!wsMember.rows[0]) {
      res.status(404).json({ error: '送信先ユーザーがワークスペースに存在しません' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO direct_messages (workspace_id, sender_id, receiver_id, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [wid, userId, uid, content]
    );
    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
