import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import pool from '../../config/db.js';
import { requireAuth, AuthRequest } from '../../middleware/auth.js';
import { generateSecret, verifyTotpCode, generateQRCodeDataURL } from './totpService.js';

const router = Router();

const PENDING_COOKIE = 'pending_token';
const PENDING_EXPIRES_MS = 15 * 60 * 1000; // 15分

function getPendingSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

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

    const pendingToken = req.cookies?.[PENDING_COOKIE];
    if (!pendingToken) { res.status(401).json({ error: '認証セッションが見つかりません' }); return; }

    let payload: { userId: string; username: string; totp_pending: boolean };
    try {
      payload = jwt.verify(pendingToken, getPendingSecret()) as typeof payload;
    } catch {
      res.status(401).json({ error: '認証セッションが期限切れです' });
      return;
    }
    if (!payload.totp_pending) { res.status(401).json({ error: '無効なトークンです' }); return; }

    const { rows } = await pool.query(
      'SELECT totp_secret FROM users WHERE id = $1',
      [payload.userId]
    );
    const user = rows[0];
    if (!user?.totp_secret || !verifyTotpCode(user.totp_secret, code)) {
      res.status(422).json({ error: 'コードが正しくありません' });
      return;
    }

    await pool.query("UPDATE users SET status = 'online' WHERE id = $1", [payload.userId]);

    const { signToken } = await import('../../utils/jwt.js');
    const token = signToken({ userId: payload.userId, username: payload.username });

    res.clearCookie(PENDING_COOKIE);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { rows: userRows } = await pool.query(
      'SELECT id, username, display_name, avatar_url, status FROM users WHERE id = $1',
      [payload.userId]
    );
    res.json({ user: userRows[0] });
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

export { PENDING_COOKIE, PENDING_EXPIRES_MS };
export default router;
