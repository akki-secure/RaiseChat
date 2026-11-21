import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { applyTrustProxy } from './proxy.js';

// req.ip をそのまま返すだけのアプリ。hops は環境変数 TRUST_PROXY_HOPS の値を想定
function buildApp(hops: string | undefined) {
  const app = express();
  applyTrustProxy(app, hops);
  app.get('/ip', (req, res) => { res.json({ ip: req.ip }); });
  return app;
}

async function ipSeenBy(hops: string | undefined) {
  const res = await request(buildApp(hops)).get('/ip').set('X-Forwarded-For', '1.2.3.4');
  return res.body.ip as string;
}

describe('applyTrustProxy', () => {
  it('未設定なら X-Forwarded-For を信頼しない（偽装を無視する）', async () => {
    expect(await ipSeenBy(undefined)).not.toBe('1.2.3.4');
  });

  it("'1' なら X-Forwarded-For のIPが req.ip になる", async () => {
    expect(await ipSeenBy('1')).toBe('1.2.3.4');
  });

  it("'0' と空文字は信頼しない", async () => {
    expect(await ipSeenBy('0')).not.toBe('1.2.3.4');
    expect(await ipSeenBy('')).not.toBe('1.2.3.4');
  });

  it('不正な値（負数・小数・文字）は起動時にエラーにする', () => {
    for (const bad of ['-1', '1.5', 'abc']) {
      expect(() => buildApp(bad)).toThrow('TRUST_PROXY_HOPS');
    }
  });
});
