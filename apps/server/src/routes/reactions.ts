import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// POST /api/messages/:mid/reactions
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mid } = req.params;
    const userId = req.user!.userId;
    const { emoji } = z.object({ emoji: z.string().min(1).max(50) }).parse(req.body);

    await pool.query(
      'INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [mid, userId, emoji]
    );
    res.status(201).json({ message: 'リアクションを追加しました' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/messages/:mid/reactions/:emoji
router.delete('/:emoji', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mid, emoji } = req.params;
    const userId = req.user!.userId;

    await pool.query(
      'DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [mid, userId, emoji]
    );
    res.json({ message: 'リアクションを削除しました' });
  } catch (err) {
    next(err);
  }
});

export default router;
