import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const query = vi.fn();
vi.mock('../config/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a), connect: vi.fn() } }));
vi.mock('../socket/ioInstance.js', () => ({ getIo: () => ({ to: () => ({ emit: vi.fn() }) }) }));

import { signToken } from '../utils/jwt.js';
import workspacesRouter from './workspaces.js';
import channelsRouter from './channels.js';
import messagesRouter from './messages.js';
import reactionsRouter from './reactions.js';
import dmsRouter from './dms.js';
import { countActiveWarnings } from '../features/moderation/moderationService.js';

const WID = '11111111-1111-4111-8111-111111111111';
const CID = '22222222-2222-4222-8222-222222222222';
const MID = '44444444-4444-4444-8444-444444444444';
const UID = '33333333-3333-4333-8333-333333333333';
let cookie = '';

let app: express.Express;

// キックされたユーザーの状態を再現する。
// 「removed_at IS NULL」の条件（現メンバーの確認）には誰も当てはまらず、
// 「removed_at IS NOT NULL」の条件（キック済みの確認）には当てはまる。
const state = { workspaceKicked: true, channelType: 'public' };

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  cookie = `token=${signToken({ userId: 'kicked', username: 'jiro' })}`;
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/workspaces/:wid/channels', channelsRouter);
  app.use('/api/workspaces/:wid/dms', dmsRouter);
  app.use('/api/channels/:cid/messages', messagesRouter);
  app.use('/api/messages/:mid/reactions', reactionsRouter);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.name === 'ZodError' ? 400 : 500).json({ error: err.message });
  });
});

beforeEach(() => {
  query.mockReset();
  state.workspaceKicked = true;
  state.channelType = 'public';
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM workspaces WHERE invite_code')) {
      return { rows: [{ id: WID, name: 'ws', owner_id: 'o', invite_code: 'abc' }] };
    }
    if (sql.includes('SELECT type FROM channels')) return { rows: [{ type: state.channelType }] };
    if (sql.includes('removed_at IS NOT NULL')) return { rows: state.workspaceKicked ? [{ '?column?': 1 }] : [] };
    if (sql.includes('removed_at IS NULL')) return { rows: [] };
    return { rows: [], rowCount: 1 };
  });
});

const sqls = () => query.mock.calls.map((c) => String(c[0]));
const writes = () => sqls().filter((s) => /^\s*(INSERT|UPDATE|DELETE)/.test(s));

describe('キックされたユーザーのアクセス', () => {
  it('招待コードでワークスペースへ再参加できない（403）。メンバー登録もしない', async () => {
    const res = await request(app).post('/api/workspaces/join').set('Cookie', cookie).send({ invite_code: 'abc' });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('ワークスペースから外された人は、公開チャンネルにも参加できない（403）', async () => {
    const res = await request(app).post(`/api/workspaces/${WID}/channels/${CID}/join`).set('Cookie', cookie).send({});
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('キック解除後の入り直しは、removed_at を NULL に戻す（行は消さない）', async () => {
    // ワークスペースの現メンバーである状態
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT type FROM channels')) return { rows: [{ type: 'public' }] };
      if (sql.includes('FROM workspace_members')) return { rows: [{ '?column?': 1 }] };
      return { rows: [], rowCount: 1 };
    });
    const res = await request(app).post(`/api/workspaces/${WID}/channels/${CID}/join`).set('Cookie', cookie).send({});
    expect(res.status).toBe(200);
    const insert = sqls().find((s) => s.includes('INSERT INTO channel_members')) ?? '';
    expect(insert).toContain('ON CONFLICT (channel_id, user_id) DO UPDATE SET removed_at = NULL');
    expect(sqls().some((s) => s.includes('DELETE FROM'))).toBe(false);
  });

  it('プライベートチャンネルには、キック解除後も自分では入り直せない（403）', async () => {
    state.channelType = 'private';
    const res = await request(app).post(`/api/workspaces/${WID}/channels/${CID}/join`).set('Cookie', cookie).send({});
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('メッセージを送れない（403）', async () => {
    const res = await request(app).post(`/api/channels/${CID}/messages`).set('Cookie', cookie).send({ content: 'hi' });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('リアクションを付けられない（404）', async () => {
    const res = await request(app).post(`/api/messages/${MID}/reactions`).set('Cookie', cookie).send({ emoji: '👍' });
    expect(res.status).toBe(404);
    expect(writes()).toHaveLength(0);
  });

  it('DM を送れない（403）', async () => {
    const res = await request(app).post(`/api/workspaces/${WID}/dms/${UID}`).set('Cookie', cookie).send({ content: 'hi' });
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('DM を読めない（403）', async () => {
    const res = await request(app).get(`/api/workspaces/${WID}/dms/${UID}`).set('Cookie', cookie);
    expect(res.status).toBe(403);
  });
});

describe('countActiveWarnings', () => {
  it('取り消し済み（revoked_at あり）の警告を数えない', async () => {
    query.mockResolvedValue({ rows: [{ n: 2 }] });
    expect(await countActiveWarnings(WID, UID)).toBe(2);
    expect(String(query.mock.calls[0][0])).toContain('revoked_at IS NULL');
  });
});
