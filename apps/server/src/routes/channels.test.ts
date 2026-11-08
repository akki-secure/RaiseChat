import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const query = vi.fn();
vi.mock('../config/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a), connect: vi.fn() } }));

import { signToken } from '../utils/jwt.js';
import channelsRouter from './channels.js';

let app: express.Express;
const WID = '11111111-1111-4111-8111-111111111111';
const CID = '22222222-2222-4222-8222-222222222222';
const cookie = () => `token=${signToken({ userId: 'u1', username: 'taro' })}`;
const base = `/api/workspaces/${WID}/channels`;

// SQL の内容に応じて返す値を切り替える
const state = { role: 'owner' as string | null, channelName: 'news' as string | null, channelType: 'public', requesterIsMember: true };

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/workspaces/:wid/channels', channelsRouter);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
});

beforeEach(() => {
  query.mockReset();
  Object.assign(state, { role: 'owner', channelName: 'news', channelType: 'public', requesterIsMember: true });
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT role FROM workspace_members')) return { rows: state.role ? [{ role: state.role }] : [] };
    if (sql.includes('SELECT name FROM channels')) return { rows: state.channelName ? [{ name: state.channelName }] : [] };
    if (sql.includes('SELECT type FROM channels')) return { rows: state.channelName ? [{ type: state.channelType }] : [] };
    if (sql.includes('FROM channel_members cm')) return { rows: state.requesterIsMember ? [{ user_id: 'u1' }] : [] };
    if (sql.includes('FROM workspace_members')) return { rows: [{ user_id: 'u2' }] };
    return { rows: [], rowCount: 1 };
  });
});

const sqls = () => query.mock.calls.map((c) => String(c[0]));

describe('DELETE /channels/:cid（論理削除）', () => {
  const del = () => request(app).delete(`${base}/${CID}`).set('Cookie', cookie());

  it('物理削除せず、deleted_at と名前の印を UPDATE する', async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(sqls().some((s) => s.includes('DELETE FROM'))).toBe(false);
    const update = sqls().find((s) => s.startsWith('UPDATE channels'))!;
    expect(update).toContain('deleted_at = NOW()');
    expect(update).toContain("'~deleted~'");
    expect(update).toContain('deleted_at IS NULL'); // 二重削除しない
  });
  it('#general は削除できない（400）', async () => {
    state.channelName = 'general';
    expect((await del()).status).toBe(400);
    expect(sqls().some((s) => s.startsWith('UPDATE channels'))).toBe(false);
  });
  it('オーナー以外は 403', async () => {
    state.role = 'member';
    expect((await del()).status).toBe(403);
    expect(sqls().some((s) => s.startsWith('UPDATE channels'))).toBe(false);
  });
  it('存在しない・削除済みのチャンネルは 404', async () => {
    state.channelName = null;
    expect((await del()).status).toBe(404);
    expect(sqls().find((s) => s.includes('SELECT name FROM channels'))).toContain('deleted_at IS NULL');
  });
});

describe('削除済みチャンネルの除外', () => {
  it('一覧のSQLは削除済みを除く', async () => {
    await request(app).get(base).set('Cookie', cookie());
    expect(sqls().find((s) => s.includes('FROM channels c'))).toContain('c.deleted_at IS NULL');
  });
  it('削除済みチャンネルには参加できない（404）', async () => {
    state.channelName = null;
    const res = await request(app).post(`${base}/${CID}/join`).set('Cookie', cookie());
    expect(res.status).toBe(404);
    expect(sqls().find((s) => s.includes('SELECT type FROM channels'))).toContain('deleted_at IS NULL');
  });
  it('削除済みチャンネルには招待できない（403）', async () => {
    state.requesterIsMember = false;
    const res = await request(app).post(`${base}/${CID}/invite`).set('Cookie', cookie())
      .send({ user_id: '33333333-3333-4333-8333-333333333333' });
    expect(res.status).toBe(403);
    expect(sqls().find((s) => s.includes('FROM channel_members cm'))).toContain('c.deleted_at IS NULL');
  });
});
