import type { Express } from 'express';

// プロキシ（Caddy など）の段数。未設定・0 は「信頼しない」
export function applyTrustProxy(app: Express, hops: string | undefined): void {
  if (hops === undefined || hops === '') return;
  const n = Number(hops);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`TRUST_PROXY_HOPS は 0 以上の整数で指定してください: ${hops}`);
  }
  if (n > 0) app.set('trust proxy', n);
}
