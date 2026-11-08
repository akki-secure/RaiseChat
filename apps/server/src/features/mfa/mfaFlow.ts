import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../../config/db.js';
import { signToken } from '../../utils/jwt.js';
import { countPasskeys } from '../passkey/passkeyService.js';
import { MAX_FAILED_ATTEMPTS, getLockRemainingMs, recordFailure, resetFailures } from './mfaService.js';

export const PENDING_COOKIE = 'pending_token';
export const PENDING_EXPIRES_MS = 15 * 60 * 1000; // 15分

export type Factor = 'totp' | 'passkey';
export interface Pending { userId: string; username: string; passed: Factor[] }

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
};

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

// pending_token を発行（/login と、両方必須の途中経過で共用）
export function issuePending(res: Response, p: Pending): void {
  const t = jwt.sign({ userId: p.userId, username: p.username, totp_pending: true, passed: p.passed },
    secret(), { expiresIn: '15m' });
  res.cookie(PENDING_COOKIE, t, { ...cookieBase, maxAge: PENDING_EXPIRES_MS });
}

// pending_token（パスワード認証済み・2FA待ち）。passed は通過済みの手段
export function readPending(req: Request): Pending | null {
  const t = req.cookies?.[PENDING_COOKIE];
  if (!t) return null;
  try {
    const p = jwt.verify(t, secret()) as { userId: string; username: string; totp_pending?: boolean; passed?: Factor[] };
    return p.totp_pending ? { userId: p.userId, username: p.username, passed: p.passed ?? [] } : null;
  } catch { return null; }
}

export async function availableFactors(userId: string): Promise<{ mode: 'any' | 'both'; factors: Factor[] }> {
  const { rows } = await pool.query('SELECT totp_enabled, mfa_mode FROM users WHERE id = $1', [userId]);
  const u = rows[0];
  if (!u) return { mode: 'any', factors: [] };
  const factors: Factor[] = [];
  if (u.totp_enabled) factors.push('totp');
  if ((await countPasskeys(userId)) > 0) factors.push('passkey');
  return { mode: u.mfa_mode, factors };
}

// ログイン完了: token 発行・pending 削除・失敗回数リセット
export async function completeSession(res: Response, userId: string, username: string) {
  await pool.query("UPDATE users SET status = 'online' WHERE id = $1", [userId]);
  await resetFailures(userId);
  res.clearCookie(PENDING_COOKIE);
  res.cookie('token', signToken({ userId, username }), { ...cookieBase, maxAge: 7 * 24 * 60 * 60 * 1000 });
  const { rows } = await pool.query(
    'SELECT id, username, display_name, avatar_url, status FROM users WHERE id = $1', [userId]);
  return rows[0];
}

// ある手段の認証に成功した後: 完了(user) か 次の手段(remaining) を返す
export async function completeFactor(res: Response, pending: Pending, factor: Factor) {
  const { mode, factors } = await availableFactors(pending.userId);
  const passed = Array.from(new Set<Factor>([...pending.passed, factor]));
  const required = mode === 'both' ? factors : [factor];
  const remaining = required.filter((f) => !passed.includes(f));
  if (remaining.length === 0) {
    return { user: await completeSession(res, pending.userId, pending.username) };
  }
  issuePending(res, { ...pending, passed });
  return { remaining };
}

// ロック中なら 429 を返して true
export async function respondIfLocked(res: Response, userId: string): Promise<boolean> {
  const ms = await getLockRemainingMs(userId);
  if (ms <= 0) return false;
  res.status(429).json({
    error: `認証に${MAX_FAILED_ATTEMPTS}回失敗したため一時的にロックされています。約${Math.ceil(ms / 60000)}分後に再試行してください`,
    retryAfterSec: Math.ceil(ms / 1000),
  });
  return true;
}

// 失敗を記録して応答（5回目でロック→429、それ以外は422）
export async function failAttempt(res: Response, userId: string, message: string): Promise<void> {
  const { locked } = await recordFailure(userId);
  if (locked && (await respondIfLocked(res, userId))) return;
  res.status(422).json({ error: message });
}
