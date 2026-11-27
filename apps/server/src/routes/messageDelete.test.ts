import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const query = vi.fn();
vi.mock('../config/db.js', () => ({
  default: { query: (...a: unknown[]) => query(...a) },
}));

const emit = vi.fn();
vi.mock('../socket/ioInstance.js', () => ({
  getIo: () => ({ to: (room: string) => ({ emit: (...a: unknown[]) => emit(room, ...a) }) }),
}));

import { signToken } from '../utils/jwt.js';
import messagesRouter from './messages.js';

const CID = '55555555-5555-4555-8555-555555555555';
const MID = '77777777-7777-4777-8777-777777777777';
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
});

const found = (user_id: string, role: string) =>
  query.mockImplementation(async (sql: string) =>
    sql.includes('SELECT m.user_id') ? { rows: [{ user_id, channel_id: CID, role }] } : { rows: [] }
  );

const del = () =>
  request(app)
    .delete(`/api/channels/${CID}/messages/${MID}`)
    .set('Cookie', `token=${signToken({ userId: 'u1', username: 'taro' })}`);

const updated = () => query.mock.calls.some((c) => String(c[0]).includes('SET deleted_at'));

describe('DELETE /messages/:mid の削除通知', () => {
  it('削除に成功したら、そのチャンネルへ message:delete を送る', async () => {
    found('u1', 'member');
    const res = await del();
    expect(res.status).toBe(200);
    expect(updated()).toBe(true);
    expect(emit).toHaveBeenCalledWith(`channel:${CID}`, 'message:delete', { id: MID, channel_id: CID });
  });

  it('他人の投稿は 403 で、削除も通知もしない', async () => {
    found('u2', 'member');
    const res = await del();
    expect(res.status).toBe(403);
    expect(updated()).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });

  it('メッセージがなければ 404 で、通知しない', async () => {
    query.mockResolvedValue({ rows: [] });
    const res = await del();
    expect(res.status).toBe(404);
    expect(emit).not.toHaveBeenCalled();
  });
});
