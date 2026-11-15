import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../../config/db.js';
import { requireAuth, AuthRequest } from '../../middleware/auth.js';
import { getIo } from '../../socket/ioInstance.js';
import logger from '../../utils/logger.js';
import { countActiveWarnings, canKick, KICK_WARNING_THRESHOLD } from './moderationService.js';

// /api/workspaces/:wid/members 配下
const router = Router({ mergeParams: true });
router.use(requireAuth);

const uuid = z.string().uuid();

// ワークスペースのオーナーか確認する。違えば 403 を返して false
async function assertOwner(wid: string, userId: string, res: Response): Promise<boolean> {
  const member = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND removed_at IS NULL',
    [wid, userId]
  );
  if (member.rows[0]?.role !== 'owner') {
    res.status(403).json({ error: '権限がありません' });
    return false;
  }
  return true;
}

// 対象が警告・キックできる相手（現メンバーで、owner ではない）か確認する
async function loadTarget(wid: string, uid: string, actorId: string, res: Response) {
  if (uid === actorId) {
    res.status(400).json({ error: '自分自身は対象にできません' });
    return null;
  }
  const target = await pool.query(
    'SELECT role, removed_at FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [wid, uid]
  );
  if (!target.rows[0]) {
    res.status(404).json({ error: 'メンバーが見つかりません' });
    return null;
  }
  if (target.rows[0].role === 'owner') {
    res.status(400).json({ error: 'オーナーは対象にできません' });
    return null;
  }
  return target.rows[0] as { role: string; removed_at: string | null };
}

// GET /removed — キックされたメンバー一覧（owner のみ。キック解除の画面で使う）
router.get('/removed', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wid = uuid.parse(req.params.wid);
    if (!(await assertOwner(wid, req.user!.userId, res))) return;

    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.display_name, wm.removed_at, wm.removed_reason
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1 AND wm.removed_at IS NOT NULL
       ORDER BY wm.removed_at DESC`,
      [wid]
    );
    res.json({ members: rows });
  } catch (err) {
    next(err);
  }
});

// POST /:uid/warn — 警告（本人に通知。警告回数を記録する）
router.post('/:uid/warn', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wid = uuid.parse(req.params.wid);
    const uid = uuid.parse(req.params.uid);
    const { reason, message_id } = z.object({
      reason: z.string().trim().min(1).max(500),
      message_id: uuid.optional(),
    }).parse(req.body);
    const actorId = req.user!.userId;

    if (!(await assertOwner(wid, actorId, res))) return;
    const target = await loadTarget(wid, uid, actorId, res);
    if (!target) return;
    if (target.removed_at) {
      res.status(400).json({ error: 'すでにキックされているメンバーです' });
      return;
    }

    // 別のワークスペースのメッセージを指定されていないか確認する
    if (message_id) {
      const m = await pool.query(
        `SELECT 1 FROM messages m JOIN channels c ON c.id = m.channel_id
         WHERE m.id = $1 AND c.workspace_id = $2`,
        [message_id, wid]
      );
      if (!m.rows[0]) {
        res.status(400).json({ error: '対象のメッセージが見つかりません' });
        return;
      }
    }

    await pool.query(
      `INSERT INTO member_warnings (workspace_id, user_id, issued_by, reason, message_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [wid, uid, actorId, reason, message_id ?? null]
    );
    const count = await countActiveWarnings(wid, uid);

    // 監査用。理由の本文は個人的な内容を含みうるため、ログには出さない（DB の member_warnings に記録済み）
    logger.info('moderation.warn', { workspaceId: wid, actorId, targetId: uid, warningCount: count });

    getIo().to(`user:${uid}`).emit('member:warned', {
      workspace_id: wid,
      reason,
      count,
      threshold: KICK_WARNING_THRESHOLD,
    });
    res.status(201).json({ warning_count: count, threshold: KICK_WARNING_THRESHOLD });
  } catch (err) {
    next(err);
  }
});

// GET /:uid/warnings — 警告履歴（owner のみ）
router.get('/:uid/warnings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wid = uuid.parse(req.params.wid);
    const uid = uuid.parse(req.params.uid);
    if (!(await assertOwner(wid, req.user!.userId, res))) return;

    const { rows } = await pool.query(
      `SELECT id, reason, message_id, issued_by, created_at, revoked_at
       FROM member_warnings
       WHERE workspace_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [wid, uid]
    );
    res.json({
      warnings: rows,
      active_count: rows.filter((w: { revoked_at: string | null }) => !w.revoked_at).length,
      threshold: KICK_WARNING_THRESHOLD,
    });
  } catch (err) {
    next(err);
  }
});

// POST /:uid/kick — キック（owner の手動操作。論理削除。メッセージは保持）
router.post('/:uid/kick', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wid = uuid.parse(req.params.wid);
    const uid = uuid.parse(req.params.uid);
    const { reason, severe } = z.object({
      reason: z.string().trim().min(1).max(500),
      severe: z.boolean().default(false),
    }).parse(req.body);
    const actorId = req.user!.userId;

    if (!(await assertOwner(wid, actorId, res))) return;
    const target = await loadTarget(wid, uid, actorId, res);
    if (!target) return;
    if (target.removed_at) {
      res.status(400).json({ error: 'すでにキックされています' });
      return;
    }

    const client = await pool.connect();
    let channelIds: string[] = [];
    let warningCount = 0;
    let rejected: { status: number; error: string } | null = null;
    try {
      await client.query('BEGIN');
      // 対象の行をロックする。同時にキックが押されても、あとの処理はここで待たされる
      const locked = await client.query(
        `SELECT removed_at FROM workspace_members
         WHERE workspace_id = $1 AND user_id = $2 FOR UPDATE`,
        [wid, uid]
      );
      if (!locked.rows[0] || locked.rows[0].removed_at) {
        rejected = { status: 409, error: 'すでにキックされています' };
      } else {
        const counted = await client.query(
          `SELECT COUNT(*)::int AS n FROM member_warnings
           WHERE workspace_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
          [wid, uid]
        );
        warningCount = counted.rows[0].n;
        if (!canKick(warningCount, severe)) {
          rejected = {
            status: 400,
            error: `警告が${KICK_WARNING_THRESHOLD}回に達していません（現在${warningCount}回）。重大違反の場合は重大違反として指定してください`,
          };
        }
      }
      if (rejected) {
        await client.query('ROLLBACK');
      } else {
        await client.query(
          `UPDATE workspace_members SET removed_at = NOW(), removed_reason = $3
           WHERE workspace_id = $1 AND user_id = $2 AND removed_at IS NULL`,
          [wid, uid, reason]
        );
        const left = await client.query(
          `UPDATE channel_members cm SET removed_at = NOW()
           FROM channels c
           WHERE cm.channel_id = c.id AND c.workspace_id = $1
             AND cm.user_id = $2 AND cm.removed_at IS NULL
           RETURNING cm.channel_id`,
          [wid, uid]
        );
        channelIds = left.rows.map((r: { channel_id: string }) => r.channel_id);
        await client.query('COMMIT');
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    if (rejected) {
      res.status(rejected.status).json({ error: rejected.error });
      return;
    }

    logger.info('moderation.kick', {
      workspaceId: wid, actorId, targetId: uid, severe, warningCount, channelsLeft: channelIds.length,
    });

    // 本人へ通知し、リアルタイム配信から外す
    const io = getIo();
    io.to(`user:${uid}`).emit('member:kicked', { workspace_id: wid, reason });
    if (channelIds.length > 0) {
      io.in(`user:${uid}`).socketsLeave(channelIds.map((id) => `channel:${id}`));
    }
    res.json({ message: 'メンバーをキックしました' });
  } catch (err) {
    next(err);
  }
});

// POST /:uid/unkick — キック解除（再参加できるようにする。チャンネルへは入り直し）
router.post('/:uid/unkick', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wid = uuid.parse(req.params.wid);
    const uid = uuid.parse(req.params.uid);
    const actorId = req.user!.userId;
    if (!(await assertOwner(wid, actorId, res))) return;

    const result = await pool.query(
      `UPDATE workspace_members SET removed_at = NULL, removed_reason = NULL
       WHERE workspace_id = $1 AND user_id = $2 AND removed_at IS NOT NULL`,
      [wid, uid]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'キックされたメンバーが見つかりません' });
      return;
    }
    logger.info('moderation.unkick', { workspaceId: wid, actorId, targetId: uid });
    res.json({ message: 'キックを解除しました' });
  } catch (err) {
    next(err);
  }
});

export default router;
