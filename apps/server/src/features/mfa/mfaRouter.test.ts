import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const query = vi.fn();
vi.mock('../../config/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));
vi.mock('../passkey/passkeyService.js', () => ({ countPasskeys: vi.fn() }));
vi.mock('./mfaService.js', () => ({
  MAX_FAILED_ATTEMPTS: 5,
  getLockRemainingMs: vi.fn(), recordFailure: vi.fn(), resetFailures: vi.fn(),
  countActiveRecoveryCodes: vi.fn(), consumeRecoveryCode: vi.fn(), regenerateRecoveryCodes: vi.fn(),
}));

import { countPasskeys } from '../passkey/passkeyService.js';
import * as svc from './mfaService.js';
import { signToken } from '../../utils/jwt.js';
import mfaRouter from './mfaRouter.js';

let hash: string;
let app: express.Express;
const state = { totp: true };

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  hash = await bcrypt.hash('pw12345!', 4);
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/mfa', mfaRouter);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: err.message });
  });
});

const authCookie = () => `token=${signToken({ userId: 'u1', username: 'taro' })}`;
const pendingCookie = () =>
  `pending_token=${jwt.sign({ userId: 'u1', username: 'taro', totp_pending: true }, 'test-secret', { expiresIn: '15m' })}`;

beforeEach(() => {
  vi.resetAllMocks();
  state.totp = true;
  vi.mocked(countPasskeys).mockResolvedValue(1);
  vi.mocked(svc.countActiveRecoveryCodes).mockResolvedValue(8);
  vi.mocked(svc.getLockRemainingMs).mockResolvedValue(0);
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('password_hash')) return { rows: [{ password_hash: hash }] };
    if (sql.includes('SELECT totp_enabled')) return { rows: [{ totp_enabled: state.totp }] };
    if (sql.includes('SELECT id, username, display_name')) return { rows: [{ id: 'u1', username: 'taro' }] };
    return { rows: [] };
  });
});

describe('PATCH /api/mfa/mode', () => {
  const patch = (body: object) => request(app).patch('/api/mfa/mode').set('Cookie', authCookie()).send(body);

  it('未ログインは 401', async () => {
    expect((await request(app).patch('/api/mfa/mode').send({ mode: 'both', password: 'x' })).status).toBe(401);
  });
  it('パスワードが違えば 422', async () => {
    expect((await patch({ mode: 'both', password: 'wrong' })).status).toBe(422);
  });
  it('「両方必須」はリカバリーコードが無ければ 409', async () => {
    vi.mocked(svc.countActiveRecoveryCodes).mockResolvedValue(0);
    const res = await patch({ mode: 'both', password: 'pw12345!' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('リカバリーコード');
  });
  it('「両方必須」は TOTP が無効なら 409', async () => {
    state.totp = false;
    const res = await patch({ mode: 'both', password: 'pw12345!' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('TOTP');
  });
  it('条件が揃えば切り替わる', async () => {
    const res = await patch({ mode: 'both', password: 'pw12345!' });
    expect(res.status).toBe(200);
    expect(query.mock.calls.some((c) => String(c[0]).includes('UPDATE users SET mfa_mode'))).toBe(true);
  });
});

describe('POST /api/mfa/recovery/verify', () => {
  const post = (cookie?: string) => {
    const r = request(app).post('/api/mfa/recovery/verify');
    return (cookie ? r.set('Cookie', cookie) : r).send({ code: 'ABCDE-FGHIJ' });
  };

  it('pending_token が無ければ 401', async () => {
    expect((await post()).status).toBe(401);
  });
  it('ロック中は 429 で、コードを消費しない', async () => {
    vi.mocked(svc.getLockRemainingMs).mockResolvedValue(600_000);
    expect((await post(pendingCookie())).status).toBe(429);
    expect(svc.consumeRecoveryCode).not.toHaveBeenCalled();
  });
  it('コードが違えば失敗を記録して 422', async () => {
    vi.mocked(svc.consumeRecoveryCode).mockResolvedValue(false);
    vi.mocked(svc.recordFailure).mockResolvedValue({ locked: false });
    expect((await post(pendingCookie())).status).toBe(422);
    expect(svc.recordFailure).toHaveBeenCalledWith('u1');
  });
  it('コードが合えば token を発行して pending を消す', async () => {
    vi.mocked(svc.consumeRecoveryCode).mockResolvedValue(true);
    const res = await post(pendingCookie());
    expect(res.status).toBe(200);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookies).toContain('token=');
    expect(cookies).toMatch(/pending_token=;/); // 削除（空にする）
    expect(res.body.remainingRecoveryCodes).toBe(8);
  });
});
