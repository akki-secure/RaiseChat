import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const query = vi.fn();
vi.mock('../config/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));
const uploadToS3 = vi.fn();
vi.mock('../utils/s3.js', () => ({ uploadToS3: (...a: unknown[]) => uploadToS3(...a) }));

import { signToken } from '../utils/jwt.js';
import uploadRouter from './upload.js';

let app: express.Express;
const URL = 'https://example.test/uploads/a.png';
const cookie = () => `token=${signToken({ userId: 'u1', username: 'taro' })}`;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = express();
  app.use(cookieParser());
  app.use('/api/upload', uploadRouter);
});

beforeEach(() => {
  query.mockReset();
  uploadToS3.mockReset();
  uploadToS3.mockResolvedValue(URL);
});

describe('POST /upload', () => {
  const post = () => request(app).post('/api/upload').set('Cookie', cookie());
  const file = { filename: 'a.png', contentType: 'image/png' };

  it('アップロードした URL・形式・サイズを返す', async () => {
    const res = await post().attach('file', Buffer.from('a'), file);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ url: URL, file_type: 'image/png', size: 1 });
  });

  it('message_id を送られても、DB には何も書き込まない', async () => {
    const res = await post()
      .field('message_id', '44444444-4444-4444-8444-444444444444')
      .attach('file', Buffer.from('a'), file);
    expect(res.status).toBe(201);
    expect(query).not.toHaveBeenCalled();
  });
});
