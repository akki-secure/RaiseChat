import rateLimit from 'express-rate-limit';

// ユーザー名+IP の組み合わせで、失敗(4xx)を15分に10回まで。成功(200)は数えない
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.username ?? '').toLowerCase().slice(0, 50)}`,
  message: { error: 'ログインの失敗が続いたため、しばらく待ってから再試行してください。' },
});
