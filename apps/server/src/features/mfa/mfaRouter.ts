import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import pool from '../../config/db.js';
import { requireAuth, AuthRequest } from '../../middleware/auth.js';
import { countPasskeys } from '../passkey/passkeyService.js';
import { countActiveRecoveryCodes, consumeRecoveryCode, regenerateRecoveryCodes } from './mfaService.js';
import { readPending, completeSession, respondIfLocked, failAttempt } from './mfaFlow.js';

const router = Router();

async function checkPassword(userId: string, password: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return !!rows[0] && bcrypt.compare(password, rows[0].password_hash);
}

// GET /api/mfa/status
router.get('/status', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { rows } = await pool.query('SELECT mfa_mode, totp_enabled FROM users WHERE id = $1', [userId]);
    res.json({
      mfa_mode: rows[0].mfa_mode,
      totp_enabled: rows[0].totp_enabled,
      passkey_count: await countPasskeys(userId),
      recovery_codes_remaining: await countActiveRecoveryCodes(userId),
    });
  } catch (e) { next(e); }
});

// PATCH /api/mfa/mode — 'both' は TOTP・パスキー・リカバリーコードが揃っている場合のみ
router.patch('/mode', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mode, password } = z.object({
      mode: z.enum(['any', 'both']), password: z.string().min(1),
    }).parse(req.body);
    const userId = req.user!.userId;
    if (!(await checkPassword(userId, password))) {
      res.status(422).json({ error: 'パスワードが正しくありません' }); return;
    }
    if (mode === 'both') {
      const { rows } = await pool.query('SELECT totp_enabled FROM users WHERE id = $1', [userId]);
      const missing: string[] = [];
      if (!rows[0].totp_enabled) missing.push('TOTP');
      if ((await countPasskeys(userId)) === 0) missing.push('パスキー');
      if ((await countActiveRecoveryCodes(userId)) === 0) missing.push('リカバリーコード');
      if (missing.length > 0) {
        res.status(409).json({ error: `先に ${missing.join('・')} を設定してください` }); return;
      }
    }
    await pool.query('UPDATE users SET mfa_mode = $1 WHERE id = $2', [mode, userId]);
    res.json({ mfa_mode: mode });
  } catch (e) { next(e); }
});

// POST /api/mfa/recovery/regenerate — 再発行（古いコードは無効化。平文は今回のみ返す）
router.post('/recovery/regenerate', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const userId = req.user!.userId;
    if (!(await checkPassword(userId, password))) {
      res.status(422).json({ error: 'パスワードが正しくありません' }); return;
    }
    const { rows } = await pool.query('SELECT totp_enabled FROM users WHERE id = $1', [userId]);
    if (!rows[0].totp_enabled && (await countPasskeys(userId)) === 0) {
      res.status(409).json({ error: '先にTOTPまたはパスキーを設定してください' }); return;
    }
    res.set('Cache-Control', 'no-store');
    res.json({ codes: await regenerateRecoveryCodes(userId) });
  } catch (e) { next(e); }
});

// POST /api/mfa/recovery/verify — ログイン中(pending_token)にリカバリーコードで2FAを代替
router.post('/recovery/verify', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().min(1).max(32) }).parse(req.body);
    const pending = readPending(req);
    if (!pending) { res.status(401).json({ error: '認証セッションが見つかりません' }); return; }
    if (await respondIfLocked(res, pending.userId)) return;
    if (!(await consumeRecoveryCode(pending.userId, code))) {
      await failAttempt(res, pending.userId, 'リカバリーコードが正しくありません'); return;
    }
    const user = await completeSession(res, pending.userId, pending.username);
    res.json({ user, remainingRecoveryCodes: await countActiveRecoveryCodes(pending.userId) });
  } catch (e) { next(e); }
});

export default router;
