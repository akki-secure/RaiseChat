import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const query = vi.fn();
vi.mock('../config/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));

import { signToken } from '../utils/jwt.js';
import reactionsRouter from './reactions.js';

let app: express.Express;
const MID = '44444444-4444-4444-8444-444444444444';
const cookie = () => `token=${signToken({ userId: 'u1', username: 'taro' })}`;
const state = { canAccess: true };

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/messages/:mid/reactions', reactionsRouter);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.name === 'ZodError' ? 400 : 500).json({ error: err.message });
  });
});

beforeEach(() => {
  query.mockReset();
  state.canAccess = true;
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM messages m')) return { rows: state.canAccess ? [{ '?column?': 1 }] : [] };
    return { rows: [], rowCount: 1 };
  });
});

const sqls = () => query.mock.calls.map((c) => String(c[0]));
const writes = () => sqls().filter((s) => /^\s*(INSERT|UPDATE|DELETE)/.test(s));

describe('POST /messages/:mid/reactions', () => {
  const post = (mid = MID) => request(app).post(`/api/messages/${mid}/reactions`).set('Cookie', cookie()).send({ emoji: '👍' });

  it('参加しているチャンネルのメッセージには追加できる。取り消し済みは付け直す（deleted_at を NULL に戻す）', async () => {
    const res = await post();
    expect(res.status).toBe(201);
    const insert = sqls().find((s) => s.includes('INSERT INTO reactions'))!;
    expect(insert).toContain('ON CONFLICT (message_id, user_id, emoji) DO UPDATE SET deleted_at = NULL');
  });
  it('チャンネルに参加していない・メッセージが存在しない・削除済みは 404 で、何も書き込まない', async () => {
    state.canAccess = false;
    expect((await post()).status).toBe(404);
    expect(writes()).toHaveLength(0);
  });
  it('参加確認のSQLは、メッセージとチャンネルの削除済みを除く', async () => {
    await post();
    const check = sqls().find((s) => s.includes('FROM messages m'))!;
    expect(check).toContain('m.deleted_at IS NULL');
    expect(check).toContain('c.deleted_at IS NULL');
    expect(check).toContain('channel_members');
  });
  it('UUIDでないメッセージIDは 400', async () => {
    expect((await post('not-a-uuid')).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('DELETE /messages/:mid/reactions/:emoji（論理削除）', () => {
  const del = () => request(app).delete(`/api/messages/${MID}/reactions/${encodeURIComponent('👍')}`).set('Cookie', cookie());

  it('物理削除せず、deleted_at を UPDATE する（取り消し済みは対象外）', async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(sqls().some((s) => s.includes('DELETE FROM'))).toBe(false);
    const update = sqls().find((s) => s.startsWith('UPDATE reactions') || s.includes('UPDATE reactions'))!;
    expect(update).toContain('deleted_at = NOW()');
    expect(update).toContain('deleted_at IS NULL');
  });
  it('参加していないメッセージは 404 で、何も書き込まない', async () => {
    state.canAccess = false;
    expect((await del()).status).toBe(404);
    expect(writes()).toHaveLength(0);
  });
});
