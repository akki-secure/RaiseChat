import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// メッセージが存在し、本人がそのチャンネルに参加している（メッセージ・チャンネルとも削除済みでない）ことを確認
async function canAccessMessage(mid: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM messages m
     JOIN channels c ON c.id = m.channel_id
     JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = $2
     WHERE m.id = $1 AND m.deleted_at IS NULL AND c.deleted_at IS NULL`,
    [mid, userId]
  );
  return result.rows.length > 0;
}

// POST /api/messages/:mid/reactions
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mid = z.string().uuid().parse(req.params.mid);
    const userId = req.user!.userId;
    const { emoji } = z.object({ emoji: z.string().min(1).max(50) }).parse(req.body);

    // 存在しない場合と参加していない場合は、同じ404にして存在を知らせない
    if (!(await canAccessMessage(mid, userId))) {
      res.status(404).json({ error: 'メッセージが見つかりません' });
      return;
    }

    // 取り消し済みなら付け直す（UNIQUE(message_id, user_id, emoji) のため deleted_at を NULL に戻す）
    await pool.query(
      `INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO UPDATE SET deleted_at = NULL
       WHERE reactions.deleted_at IS NOT NULL`,
      [mid, userId, emoji]
    );
    res.status(201).json({ message: 'リアクションを追加しました' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/messages/:mid/reactions/:emoji（論理削除）
router.delete('/:emoji', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mid = z.string().uuid().parse(req.params.mid);
    const { emoji } = req.params;
    const userId = req.user!.userId;

    if (!(await canAccessMessage(mid, userId))) {
      res.status(404).json({ error: 'メッセージが見つかりません' });
      return;
    }

    await pool.query(
      `UPDATE reactions SET deleted_at = NOW()
       WHERE message_id = $1 AND user_id = $2 AND emoji = $3 AND deleted_at IS NULL`,
      [mid, userId, emoji]
    );
    res.json({ message: 'リアクションを削除しました' });
  } catch (err) {
    next(err);
  }
});

export default router;
