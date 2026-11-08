import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const query = vi.fn();
vi.mock('../../config/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));
const countPasskeys = vi.fn();
vi.mock('../passkey/passkeyService.js', () => ({ countPasskeys: (...a: unknown[]) => countPasskeys(...a) }));

import { readPending, completeFactor, respondIfLocked, failAttempt, PENDING_COOKIE, type Pending } from './mfaFlow.js';

beforeAll(() => { process.env.JWT_SECRET = 'test-secret'; });

function mockRes() {
  const res: any = { cookies: {} as Record<string, string>, cleared: [] as string[], statusCode: 200, body: undefined };
  res.cookie = vi.fn((n: string, v: string) => { res.cookies[n] = v; return res; });
  res.clearCookie = vi.fn((n: string) => { res.cleared.push(n); return res; });
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: unknown) => { res.body = b; return res; });
  return res;
}

// users の設定を差し替える: totp_enabled / mfa_mode / ロック状態
function setUser(opts: { totp: boolean; passkeys: number; mode: 'any' | 'both'; lockedMs?: number; lockedAfterFail?: boolean }) {
  countPasskeys.mockResolvedValue(opts.passkeys);
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('totp_enabled, mfa_mode')) return { rows: [{ totp_enabled: opts.totp, mfa_mode: opts.mode }] };
    if (sql.includes('SELECT id, username')) return { rows: [{ id: 'u1', username: 'taro' }] };
    if (sql.includes('SELECT locked_until')) {
      return { rows: [{ locked_until: opts.lockedMs ? new Date(Date.now() + opts.lockedMs) : null }] };
    }
    if (sql.includes('RETURNING locked_until')) {
      return { rows: [{ locked_until: opts.lockedAfterFail ? new Date(Date.now() + 900_000) : null }] };
    }
    return { rows: [] };
  });
}
const pending = (passed: Pending['passed'] = []): Pending => ({ userId: 'u1', username: 'taro', passed });
beforeEach(() => { query.mockReset(); countPasskeys.mockReset(); });

describe('readPending', () => {
  const sign = (p: object, secret = 'test-secret') => jwt.sign(p, secret, { expiresIn: '15m' });
  const req = (token?: string) => ({ cookies: token ? { [PENDING_COOKIE]: token } : {} }) as any;

  it('passed なしの旧トークンは passed: [] として読める', () => {
    expect(readPending(req(sign({ userId: 'u1', username: 'taro', totp_pending: true }))))
      .toEqual({ userId: 'u1', username: 'taro', passed: [] });
  });
  it('passed を引き継ぐ', () => {
    expect(readPending(req(sign({ userId: 'u1', username: 'taro', totp_pending: true, passed: ['totp'] })))?.passed)
      .toEqual(['totp']);
  });
  it('totp_pending でない・改ざん・Cookie なしは null', () => {
    expect(readPending(req(sign({ userId: 'u1', username: 'taro' })))).toBeNull();
    expect(readPending(req(sign({ userId: 'u1', username: 'taro', totp_pending: true }, 'other')))).toBeNull();
    expect(readPending(req())).toBeNull();
  });
});

describe('completeFactor', () => {
  it('any: 1つ通れば完了し token を発行、pending を削除', async () => {
    setUser({ totp: true, passkeys: 1, mode: 'any' });
    const res = mockRes();
    const r = await completeFactor(res, pending(), 'totp');
    expect(r).toHaveProperty('user');
    expect(res.cookies.token).toBeTruthy();
    expect(res.cleared).toContain(PENDING_COOKIE);
  });
  it('both: 1つ目では完了せず remaining を返し、token は出さない', async () => {
    setUser({ totp: true, passkeys: 1, mode: 'both' });
    const res = mockRes();
    expect(await completeFactor(res, pending(), 'totp')).toEqual({ remaining: ['passkey'] });
    expect(res.cookies.token).toBeUndefined();
    const p = jwt.verify(res.cookies[PENDING_COOKIE], 'test-secret') as any;
    expect(p.passed).toEqual(['totp']);
  });
  it('both: 2つ目（順序は逆でも）で完了する', async () => {
    setUser({ totp: true, passkeys: 1, mode: 'both' });
    const res = mockRes();
    expect(await completeFactor(res, pending(['passkey']), 'totp')).toHaveProperty('user');
    expect(res.cookies.token).toBeTruthy();
  });
  it('both: 同じ手段を2回通しても完了しない', async () => {
    setUser({ totp: true, passkeys: 1, mode: 'both' });
    const res = mockRes();
    expect(await completeFactor(res, pending(['totp']), 'totp')).toEqual({ remaining: ['passkey'] });
    expect(res.cookies.token).toBeUndefined();
  });
});

describe('ロック応答', () => {
  it('ロック中は 429 を返し true', async () => {
    setUser({ totp: true, passkeys: 0, mode: 'any', lockedMs: 600_000 });
    const res = mockRes();
    expect(await respondIfLocked(res, 'u1')).toBe(true);
    expect(res.statusCode).toBe(429);
    expect(res.body.retryAfterSec).toBeGreaterThan(0);
  });
  it('ロックされていなければ false で何も返さない', async () => {
    setUser({ totp: true, passkeys: 0, mode: 'any' });
    const res = mockRes();
    expect(await respondIfLocked(res, 'u1')).toBe(false);
    expect(res.json).not.toHaveBeenCalled();
  });
  it('failAttempt: 通常は 422、5回目でロックされたら 429', async () => {
    setUser({ totp: true, passkeys: 0, mode: 'any' });
    let res = mockRes();
    await failAttempt(res, 'u1', 'コードが正しくありません');
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('コードが正しくありません');

    setUser({ totp: true, passkeys: 0, mode: 'any', lockedMs: 900_000, lockedAfterFail: true });
    res = mockRes();
    await failAttempt(res, 'u1', 'コードが正しくありません');
    expect(res.statusCode).toBe(429);
  });
});
