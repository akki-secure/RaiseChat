import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const query = vi.fn();
vi.mock('../config/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));
vi.mock('../socket/ioInstance.js', () => ({ getIo: () => null }));

import { signToken } from '../utils/jwt.js';

const CID = '55555555-5555-4555-8555-555555555555';
const WID = '66666666-6666-4666-8666-666666666666';
const UID = '77777777-7777-4777-8777-777777777777';
const cookieOf = (userId: string) => `token=${signToken({ userId, username: userId })}`;

// messageLimiter はモジュール内にカウンタを持つので、テストごとにモジュールを読み直す
async function buildApp() {
  vi.resetModules();
  const { default: messagesRouter } = await import('./messages.js');
  const { default: dmsRouter } = await import('./dms.js');
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/channels/:cid/messages', messagesRouter as unknown as express.Router);
  app.use('/api/workspaces/:wid/dms', dmsRouter as unknown as express.Router);
  // 中身のエラー（DBがモックのため）は500でよい。ここで見るのは429かどうか
  app.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'x' });
  });
  return app;
}

let app: express.Express;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

beforeEach(async () => {
  query.mockReset();
  query.mockResolvedValue({ rows: [], rowCount: 0 });
  app = await buildApp();
});

const postMsg = (user: string) =>
  request(app).post(`/api/channels/${CID}/messages`).set('Cookie', cookieOf(user)).send({ content: 'hi' });
const postDm = (user: string) =>
  request(app).post(`/api/workspaces/${WID}/dms/${UID}`).set('Cookie', cookieOf(user)).send({ content: 'hi' });

describe('メッセージ送信の頻度制限', () => {
  it('チャンネル: 同じユーザーの61回目は429になる', async () => {
    for (let i = 0; i < 60; i++) expect((await postMsg('u1')).status).not.toBe(429);
    const res = await postMsg('u1');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('メッセージの送信頻度が高すぎます。');
  });

  it('DM: 同じユーザーの61回目は429になる', async () => {
    for (let i = 0; i < 60; i++) expect((await postDm('u1')).status).not.toBe(429);
    expect((await postDm('u1')).status).toBe(429);
  });

  it('別のユーザーは影響を受けない', async () => {
    for (let i = 0; i < 61; i++) await postMsg('u1');
    expect((await postMsg('u2')).status).not.toBe(429);
  });

  it('取得（GET）は制限されない', async () => {
    for (let i = 0; i < 100; i++) {
      const res = await request(app).get(`/api/channels/${CID}/messages`).set('Cookie', cookieOf('u1'));
      expect(res.status).not.toBe(429);
    }
  });
});
