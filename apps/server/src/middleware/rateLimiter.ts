import rateLimit from 'express-rate-limit';
import type { AuthRequest } from './auth.js';

// 認証エンドポイント: 15分に100回まで（ブルートフォース対策）
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
});

// メッセージ送信: 1分に60回まで（スパム対策）
// 認証の後ろで使う前提で、IPではなくユーザーIDで数える（同じIPの別ユーザーと枠を共有しない）
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user!.userId,
  message: { error: 'メッセージの送信頻度が高すぎます。' },
});

// ファイルアップロード: 1分に10回まで
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'アップロード頻度が高すぎます。' },
});
