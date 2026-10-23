import 'dotenv/config';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth.js';
import workspacesRouter from './routes/workspaces.js';
import channelsRouter from './routes/channels.js';
import messagesRouter from './routes/messages.js';
import reactionsRouter from './routes/reactions.js';
import dmsRouter from './routes/dms.js';
import uploadRouter from './routes/upload.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authLimiter, uploadLimiter } from './middleware/rateLimiter.js';
import { initSocket } from './socket/index.js';
import logger from './utils/logger.js';

const app = express();
const httpServer = http.createServer(app);

// ── セキュリティ ──
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));
// グローバルレート制限: 15分に300回
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── パーサー ──
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ── リクエストログ ──
app.use(requestLogger);

// ── ルーティング ──
app.use('/api/auth',                              authLimiter, authRouter);
app.use('/api/workspaces',                        workspacesRouter);
app.use('/api/workspaces/:wid/channels',          channelsRouter);
app.use('/api/channels/:cid/messages',            messagesRouter);
app.use('/api/messages/:mid/reactions',           reactionsRouter);
app.use('/api/workspaces/:wid/dms',               dmsRouter);
app.use('/api/upload',                            uploadLimiter, uploadRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── エラーハンドラ ──
app.use(errorHandler);

// ── Socket.io ──
initSocket(httpServer);

const PORT = parseInt(process.env.PORT ?? '4000', 10);
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
