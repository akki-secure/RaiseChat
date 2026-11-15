import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const query = vi.fn();
const clientQuery = vi.fn();
vi.mock('../config/db.js', () => ({
  default: {
    query: (...a: unknown[]) => query(...a),
    connect: async () => ({ query: (...a: unknown[]) => clientQuery(...a), release: vi.fn() }),
  },
}));

const emit = vi.fn();
vi.mock('../socket/ioInstance.js', () => ({
  getIo: () => ({ to: (room: string) => ({ emit: (...a: unknown[]) => emit(room, ...a) }) }),
}));

import { signToken } from '../utils/jwt.js';
import messagesRouter from './messages.js';

const CID = '55555555-5555-4555-8555-555555555555';
const WID = '66666666-6666-4666-8666-666666666666';
let app: express.Express;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/channels/:cid/messages', messagesRouter as unknown as express.Router);
});

beforeEach(() => {
  emit.mockReset();
  query.mockReset();
  clientQuery.mockReset();
  clientQuery.mockImplementation(async (sql: string) =>
    sql.includes('INSERT INTO messages')
      ? { rows: [{ id: 'm1', channel_id: CID, user_id: 'u1', content: 'こんにちは' }] }
      : { rows: [] }
  );
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM channel_members cm') && sql.includes('JOIN channels')) {
      return { rows: [{ user_id: 'u2', channel_name: 'general', workspace_id: WID }] };
    }
    if (sql.includes('FROM channel_members')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
    if (sql.includes('FROM users')) return { rows: [{ username: 'taro' }] };
    return { rows: [], rowCount: 1 };
  });
});

describe('POST /messages の新着通知', () => {
  it('送信者以外の現メンバーの user ルームへ message:notify を送る', async () => {
    const token = signToken({ userId: 'u1', username: 'taro' });
    const res = await request(app)
      .post(`/api/channels/${CID}/messages`)
      .set('Cookie', `token=${token}`)
      .send({ content: 'こんにちは' });
    expect(res.status).toBe(201);
    expect(emit).toHaveBeenCalledWith(
      'user:u2',
      'message:notify',
      expect.objectContaining({ channel_id: CID, channel_name: 'general', workspace_id: WID })
    );
    expect(emit).not.toHaveBeenCalledWith('user:u1', 'message:notify', expect.anything());
  });

  it('通知対象の取得は、送信者とキック済みメンバーを除く条件になっている', async () => {
    const token = signToken({ userId: 'u1', username: 'taro' });
    await request(app).post(`/api/channels/${CID}/messages`).set('Cookie', `token=${token}`).send({ content: 'x' });
    const sql = query.mock.calls.map((c) => String(c[0])).find((s) => s.includes('<> $2')) ?? '';
    expect(sql).toContain('removed_at IS NULL');
    expect(sql).toContain('cm.user_id <> $2');
  });
});
