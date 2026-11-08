import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import pool from '../../config/db.js';
import { requireAuth, AuthRequest } from '../../middleware/auth.js';
import { readPending, completeFactor, respondIfLocked, failAttempt } from '../mfa/mfaFlow.js';
import * as svc from './passkeyService.js';

const router = Router();
const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
};

// GET /api/passkey — 一覧
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { res.json({ passkeys: await svc.listPasskeys(req.user!.userId) }); } catch (e) { next(e); }
});

// POST /api/passkey/register/options
router.post('/register/options', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, username } = req.user!;
    const options = await svc.createRegistrationOptions(userId, username);
    res.cookie(svc.CHALLENGE_COOKIE, svc.signChallenge(options.challenge, 'register', userId),
      { ...cookieBase, maxAge: svc.CHALLENGE_EXPIRES_MS });
    res.json(options);
  } catch (e) { next(e); }
});

// POST /api/passkey/register/verify
router.post('/register/verify', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { response, deviceName } = z.object({
      response: z.any(), deviceName: z.string().trim().min(1).max(100).default('パスキー'),
    }).parse(req.body);
    const userId = req.user!.userId;
    const challenge = svc.readChallenge(req.cookies?.[svc.CHALLENGE_COOKIE], 'register', userId);
    res.clearCookie(svc.CHALLENGE_COOKIE); // 1回限り
    if (!challenge) { res.status(400).json({ error: '認証セッションが期限切れです' }); return; }
    const ok = await svc.verifyAndSaveRegistration(userId, response, challenge, deviceName);
    if (!ok) { res.status(422).json({ error: 'パスキーを検証できませんでした' }); return; }
    res.json({ message: 'パスキーを登録しました' });
  } catch (e) { next(e); }
});

// POST /api/passkey/authenticate/options（pending_token 必須）
router.post('/authenticate/options', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pending = readPending(req);
    if (!pending) { res.status(401).json({ error: '認証セッションが見つかりません' }); return; }
    if (await respondIfLocked(res, pending.userId)) return;
    const options = await svc.createAuthenticationOptions(pending.userId);
    res.cookie(svc.CHALLENGE_COOKIE, svc.signChallenge(options.challenge, 'authenticate', pending.userId),
      { ...cookieBase, maxAge: svc.CHALLENGE_EXPIRES_MS });
    res.json(options);
  } catch (e) { next(e); }
});

// POST /api/passkey/authenticate/verify（成功で { user } か 次の手段 { remaining }）
router.post('/authenticate/verify', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { response } = z.object({ response: z.any() }).parse(req.body);
    const pending = readPending(req);
    if (!pending) { res.status(401).json({ error: '認証セッションが見つかりません' }); return; }
    if (await respondIfLocked(res, pending.userId)) return;
    const challenge = svc.readChallenge(req.cookies?.[svc.CHALLENGE_COOKIE], 'authenticate', pending.userId);
    res.clearCookie(svc.CHALLENGE_COOKIE);
    if (!challenge) { res.status(400).json({ error: '認証セッションが期限切れです' }); return; }
    if (!(await svc.verifyAuthentication(pending.userId, response, challenge))) {
      await failAttempt(res, pending.userId, 'パスキー認証に失敗しました'); return;
    }
    res.json(await completeFactor(res, pending, 'passkey'));
  } catch (e) { next(e); }
});

// DELETE /api/passkey/:id（パスワード確認必須。「両方必須」の間は不可）
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const { rows } = await pool.query('SELECT password_hash, mfa_mode FROM users WHERE id = $1', [req.user!.userId]);
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) {
      res.status(422).json({ error: 'パスワードが正しくありません' }); return;
    }
    if (rows[0].mfa_mode === 'both') {
      res.status(409).json({ error: '「両方必須」の間はパスキーを削除できません。先に「どちらか一方」へ切り替えてください' }); return;
    }
    const r = await pool.query(
      'UPDATE passkeys SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user!.userId]
    );
    if (r.rowCount === 0) { res.status(404).json({ error: 'パスキーが見つかりません' }); return; }
    res.json({ message: 'パスキーを削除しました' });
  } catch (e) { next(e); }
});

export default router;
