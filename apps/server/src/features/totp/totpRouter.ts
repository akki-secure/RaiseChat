import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../../config/db.js';
import { requireAuth, AuthRequest } from '../../middleware/auth.js';
import { generateSecret, verifyTotpCode, generateQRCodeDataURL } from './totpService.js';
import { readPending, completeFactor, respondIfLocked, failAttempt } from '../mfa/mfaFlow.js';

const router = Router();

// GET /api/totp/setup — 未有効化ユーザー向けにシークレット＋QRコードを発行
router.get('/setup', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      'SELECT username, totp_enabled, totp_secret FROM users WHERE id = $1',
      [req.user!.userId]
    );
    const user = rows[0];
    if (!user) { res.status(404).json({ error: 'ユーザーが見つかりません' }); return; }
    if (user.totp_enabled) { res.status(409).json({ error: '2段階認証は既に有効です' }); return; }

    // 既存の未確定シークレットを再利用、なければ新規生成
    const secret = user.totp_secret ?? generateSecret();
    await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, req.user!.userId]);

    const qrDataURL = await generateQRCodeDataURL(user.username, secret);
    res.json({ qrDataURL, secret });
  } catch (err) {
    next(err);
  }
});

// POST /api/totp/enable — コード確認後に2FA有効化
router.post('/enable', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    const { rows } = await pool.query(
      'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
      [req.user!.userId]
    );
    const user = rows[0];
    if (!user?.totp_secret) { res.status(400).json({ error: '先に /api/totp/setup を呼んでください' }); return; }
    if (user.totp_enabled) { res.status(409).json({ error: '既に有効です' }); return; }

    if (!verifyTotpCode(user.totp_secret, code)) {
      res.status(422).json({ error: 'コードが正しくありません' });
      return;
    }

    await pool.query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [req.user!.userId]);
    res.json({ message: '2段階認証を有効にしました' });
  } catch (err) {
    next(err);
  }
});

// POST /api/totp/verify — ログイン中TOTP検証（pending_token cookie 必須）
router.post('/verify', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    const pending = readPending(req);
    if (!pending) { res.status(401).json({ error: '認証セッションが見つかりません' }); return; }
    if (await respondIfLocked(res, pending.userId)) return;

    const { rows } = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [pending.userId]);
    if (!rows[0]?.totp_secret || !verifyTotpCode(rows[0].totp_secret, code)) {
      await failAttempt(res, pending.userId, 'コードが正しくありません');
      return;
    }
    res.json(await completeFactor(res, pending, 'totp')); // { user } か { remaining }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/totp/disable — 2FA無効化
router.delete('/disable', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    const { rows } = await pool.query(
      'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
      [req.user!.userId]
    );
    const user = rows[0];
    if (!user?.totp_enabled) { res.status(400).json({ error: '2段階認証は無効です' }); return; }

    const { rows: m } = await pool.query('SELECT mfa_mode FROM users WHERE id = $1', [req.user!.userId]);
    if (m[0]?.mfa_mode === 'both') {
      res.status(409).json({ error: '「両方必須」の間はTOTPを無効にできません。先に「どちらか一方」へ切り替えてください' });
      return;
    }

    if (!verifyTotpCode(user.totp_secret, code)) {
      res.status(422).json({ error: 'コードが正しくありません' });
      return;
    }

    await pool.query(
      'UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1',
      [req.user!.userId]
    );
    res.json({ message: '2段階認証を無効にしました' });
  } catch (err) {
    next(err);
  }
});

export default router;
