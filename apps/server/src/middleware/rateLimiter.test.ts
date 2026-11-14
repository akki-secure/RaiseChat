import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// authLimiter はモジュール内にカウンタを持つので、テストごとに読み直す
async function buildApp() {
  vi.resetModules();
  const { authLimiter: limiter } = await import('./rateLimiter.js');
  const app = express();
  app.use(express.json());
  const router = express.Router();
  router.get('/me', (_req, res) => { res.json({ ok: true }); });
  router.get('/security-question', (_req, res) => { res.json({ ok: true }); });
  router.post('/login', (_req, res) => { res.json({ ok: true }); });
  app.use('/api/auth', limiter, router);
  return app;
}

let app: express.Express;
beforeEach(async () => { app = await buildApp(); });

describe('authLimiter', () => {
  it('GET /me は 150 回送っても 429 にならない', async () => {
    for (let i = 0; i < 150; i++) {
      expect((await request(app).get('/api/auth/me')).status).toBe(200);
    }
  });

  it('POST /login は 101 回目が 429 になる', async () => {
    for (let i = 0; i < 100; i++) await request(app).post('/api/auth/login').send({});
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(429);
  });

  it('/me 以外の GET（security-question）は今までどおり数える', async () => {
    for (let i = 0; i < 100; i++) await request(app).get('/api/auth/security-question');
    expect((await request(app).get('/api/auth/security-question')).status).toBe(429);
  });

  it('/me を何度呼んでも、他のルートの残り回数は減らない', async () => {
    for (let i = 0; i < 150; i++) await request(app).get('/api/auth/me');
    for (let i = 0; i < 100; i++) {
      expect((await request(app).post('/api/auth/login').send({})).status).toBe(200);
    }
  });
});
