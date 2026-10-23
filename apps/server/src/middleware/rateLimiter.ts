import rateLimit from 'express-rate-limit';

// 認証エンドポイント: 15分に100回まで（ブルートフォース対策）
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
});

// メッセージ送信: 1分に60回まで（スパム対策）
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
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
