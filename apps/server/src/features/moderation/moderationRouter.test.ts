import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const query = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
vi.mock('../../config/db.js', () => ({
  default: {
    query: (...a: unknown[]) => query(...a),
    connect: async () => ({ query: (...a: unknown[]) => clientQuery(...a), release }),
  },
}));

const emit = vi.fn();
const socketsLeave = vi.fn();
vi.mock('../../socket/ioInstance.js', () => ({
  getIo: () => ({
    to: (room: string) => ({ emit: (...a: unknown[]) => emit(room, ...a) }),
    in: (room: string) => ({ socketsLeave: (...a: unknown[]) => socketsLeave(room, ...a) }),
  }),
}));

const logInfo = vi.fn();
vi.mock('../../utils/logger.js', () => ({ default: { info: (...a: unknown[]) => logInfo(...a), error: vi.fn() } }));

import { signToken } from '../../utils/jwt.js';
import moderationRouter from './moderationRouter.js';
import { canKick, KICK_WARNING_THRESHOLD } from './moderationService.js';

let app: express.Express;
const WID = '11111111-1111-4111-8111-111111111111';
const UID = '33333333-3333-4333-8333-333333333333';
const CID = '22222222-2222-4222-8222-222222222222';
const cookie = () => `token=${signToken({ userId: 'u1', username: 'taro' })}`;
const base = `/api/workspaces/${WID}/members/${UID}`;

const state = {
  actorRole: 'owner' as string | null,
  target: { role: 'member', removed_at: null } as { role: string; removed_at: string | null } | null,
  warnings: 0,
  unkickRows: 1,
};

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/workspaces/:wid/members', moderationRouter);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.name === 'ZodError' ? 400 : 500).json({ error: err.message });
  });
});

beforeEach(() => {
  query.mockReset();
  clientQuery.mockReset();
  emit.mockReset();
  socketsLeave.mockReset();
  logInfo.mockReset();
  Object.assign(state, {
    actorRole: 'owner',
    target: { role: 'member', removed_at: null },
    warnings: 0,
    unkickRows: 1,
  });
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT role FROM workspace_members')) {
      return { rows: state.actorRole ? [{ role: state.actorRole }] : [] };
    }
    if (sql.includes('SELECT role, removed_at FROM workspace_members')) {
      return { rows: state.target ? [state.target] : [] };
    }
    if (sql.includes('COUNT(*)')) return { rows: [{ n: state.warnings }] };
    if (sql.includes('FROM member_warnings')) return { rows: [] };
    if (sql.includes('removed_at = NULL')) return { rows: [], rowCount: state.unkickRows };
    return { rows: [], rowCount: 1 };
  });
  clientQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('RETURNING cm.channel_id')) return { rows: [{ channel_id: CID }] };
    return { rows: [], rowCount: 1 };
  });
});

const sqls = () => query.mock.calls.map((c) => String(c[0]));
const clientSqls = () => clientQuery.mock.calls.map((c) => String(c[0]));

describe('canKick（キック条件）', () => {
  it('警告が閾値未満で重大違反でなければ不可', () => {
    expect(canKick(KICK_WARNING_THRESHOLD - 1, false)).toBe(false);
  });
  it('警告が閾値に達すれば可', () => {
    expect(canKick(KICK_WARNING_THRESHOLD, false)).toBe(true);
  });
  it('重大違反なら警告0回でも可', () => {
    expect(canKick(0, true)).toBe(true);
  });
});

describe('POST /:uid/warn', () => {
  const warn = (body: unknown = { reason: '人格否定の発言' }) =>
    request(app).post(`${base}/warn`).set('Cookie', cookie()).send(body as object);

  it('警告を INSERT し、本人へ通知して 201', async () => {
    state.warnings = 1;
    const res = await warn();
    expect(res.status).toBe(201);
    expect(res.body.warning_count).toBe(1);
    expect(sqls().some((s) => s.includes('INSERT INTO member_warnings'))).toBe(true);
    expect(emit).toHaveBeenCalledWith(`user:${UID}`, 'member:warned', expect.objectContaining({ count: 1 }));
  });
  it('警告が閾値に達しても自動ではキックしない', async () => {
    state.warnings = KICK_WARNING_THRESHOLD;
    const res = await warn();
    expect(res.status).toBe(201);
    expect(sqls().some((s) => s.includes('UPDATE workspace_members'))).toBe(false);
    expect(clientQuery).not.toHaveBeenCalled();
  });
  it('オーナー以外は 403 で、何も書き込まない', async () => {
    state.actorRole = 'member';
    expect((await warn()).status).toBe(403);
    expect(sqls().some((s) => s.includes('INSERT INTO'))).toBe(false);
  });
  it('理由が空なら 400', async () => {
    expect((await warn({ reason: '  ' })).status).toBe(400);
    expect(sqls().some((s) => s.includes('INSERT INTO'))).toBe(false);
  });
  it('オーナーは対象にできない（400）', async () => {
    state.target = { role: 'owner', removed_at: null };
    expect((await warn()).status).toBe(400);
  });
  it('キック済みのメンバーには警告できない（400）', async () => {
    state.target = { role: 'member', removed_at: '2026-11-15T00:00:00Z' };
    expect((await warn()).status).toBe(400);
  });
  it('存在しないメンバーは 404', async () => {
    state.target = null;
    expect((await warn()).status).toBe(404);
  });
});

describe('POST /:uid/kick', () => {
  const kick = (body: unknown = { reason: '3回の警告を無視' }) =>
    request(app).post(`${base}/kick`).set('Cookie', cookie()).send(body as object);

  it('警告が足りず重大違反でもなければ 400。何も更新しない', async () => {
    state.warnings = KICK_WARNING_THRESHOLD - 1;
    const res = await kick();
    expect(res.status).toBe(400);
    expect(clientQuery).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
  it('警告が閾値に達していればキックできる（論理削除・物理削除なし）', async () => {
    state.warnings = KICK_WARNING_THRESHOLD;
    const res = await kick();
    expect(res.status).toBe(200);
    const all = clientSqls();
    expect(all[0]).toBe('BEGIN');
    expect(all.some((s) => s.includes('UPDATE workspace_members SET removed_at = NOW()'))).toBe(true);
    expect(all.some((s) => s.includes('UPDATE channel_members'))).toBe(true);
    expect(all.some((s) => s.includes('DELETE FROM'))).toBe(false);
    expect(all).toContain('COMMIT');
  });
  it('キックすると本人へ通知し、チャンネルのルームから外す', async () => {
    state.warnings = KICK_WARNING_THRESHOLD;
    await kick();
    expect(emit).toHaveBeenCalledWith(`user:${UID}`, 'member:kicked', expect.objectContaining({ workspace_id: WID }));
    expect(socketsLeave).toHaveBeenCalledWith(`user:${UID}`, [`channel:${CID}`]);
  });
  it('重大違反(severe)なら警告0回でもキックできる', async () => {
    state.warnings = 0;
    expect((await kick({ reason: '人格否定', severe: true })).status).toBe(200);
  });
  it('理由が無ければ 400', async () => {
    state.warnings = KICK_WARNING_THRESHOLD;
    expect((await kick({ severe: true })).status).toBe(400);
    expect(clientQuery).not.toHaveBeenCalled();
  });
  it('オーナー以外は 403', async () => {
    state.actorRole = 'member';
    expect((await kick({ reason: 'x', severe: true })).status).toBe(403);
    expect(clientQuery).not.toHaveBeenCalled();
  });
  it('オーナー自身は対象にできない（400）', async () => {
    state.target = { role: 'owner', removed_at: null };
    expect((await kick({ reason: 'x', severe: true })).status).toBe(400);
  });
  it('すでにキック済みなら 400', async () => {
    state.target = { role: 'member', removed_at: '2026-11-15T00:00:00Z' };
    expect((await kick({ reason: 'x', severe: true })).status).toBe(400);
  });
  it('更新に失敗したら ROLLBACK する', async () => {
    state.warnings = KICK_WARNING_THRESHOLD;
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('UPDATE channel_members')) throw new Error('db error');
      return { rows: [], rowCount: 1 };
    });
    expect((await kick()).status).toBe(500);
    expect(clientSqls()).toContain('ROLLBACK');
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('POST /:uid/unkick', () => {
  const unkick = () => request(app).post(`${base}/unkick`).set('Cookie', cookie());

  it('removed_at を NULL に戻す（チャンネル所属は戻さない）', async () => {
    const res = await unkick();
    expect(res.status).toBe(200);
    expect(sqls().some((s) => s.includes('UPDATE workspace_members SET removed_at = NULL'))).toBe(true);
    expect(sqls().some((s) => s.includes('UPDATE channel_members'))).toBe(false);
  });
  it('キックされていないメンバーは 404', async () => {
    state.unkickRows = 0;
    expect((await unkick()).status).toBe(404);
  });
  it('オーナー以外は 403', async () => {
    state.actorRole = 'member';
    expect((await unkick()).status).toBe(403);
  });
});

describe('監査ログ', () => {
  it('警告・キック・キック解除を構造化ログに残す（理由の本文は出さない）', async () => {
    state.warnings = KICK_WARNING_THRESHOLD;
    await request(app).post(`${base}/warn`).set('Cookie', cookie()).send({ reason: '秘密の理由A' });
    await request(app).post(`${base}/kick`).set('Cookie', cookie()).send({ reason: '秘密の理由B' });
    await request(app).post(`${base}/unkick`).set('Cookie', cookie());

    const events = logInfo.mock.calls.map((c) => c[0]);
    expect(events).toEqual(['moderation.warn', 'moderation.kick', 'moderation.unkick']);
    const kick = logInfo.mock.calls[1][1];
    expect(kick).toMatchObject({ workspaceId: WID, actorId: 'u1', targetId: UID, severe: false });
    expect(JSON.stringify(logInfo.mock.calls)).not.toContain('秘密の理由');
  });
  it('拒否された操作はログに残さない', async () => {
    state.actorRole = 'member';
    await request(app).post(`${base}/kick`).set('Cookie', cookie()).send({ reason: 'x', severe: true });
    expect(logInfo).not.toHaveBeenCalled();
  });
});

describe('GET /removed', () => {
  const removed = () => request(app).get(`/api/workspaces/${WID}/members/removed`).set('Cookie', cookie());

  it('オーナーはキック済みメンバーを取得できる', async () => {
    const res = await removed();
    expect(res.status).toBe(200);
    expect(sqls().some((s) => s.includes('removed_at IS NOT NULL'))).toBe(true);
  });
  it('オーナー以外は 403', async () => {
    state.actorRole = 'member';
    expect((await removed()).status).toBe(403);
  });
});

describe('GET /:uid/warnings', () => {
  it('オーナー以外は 403', async () => {
    state.actorRole = 'member';
    const res = await request(app).get(`${base}/warnings`).set('Cookie', cookie());
    expect(res.status).toBe(403);
  });
  it('オーナーは履歴を取得できる', async () => {
    const res = await request(app).get(`${base}/warnings`).set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.threshold).toBe(KICK_WARNING_THRESHOLD);
  });
});
