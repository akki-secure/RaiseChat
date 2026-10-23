import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { registerMessageHandlers } from './handlers/messageHandlers.js';
import { registerPresenceHandlers } from './handlers/presenceHandlers.js';
import { setIo } from './ioInstance.js';
import logger from '../utils/logger.js';

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    },
  });

  // JWT認証（auth.token → Cookie の順にフォールバック）
  io.use((socket, next) => {
    let token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      const cookieHeader = socket.handshake.headers.cookie ?? '';
      const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
      token = match ? decodeURIComponent(match[1]) : undefined;
    }
    if (!token) {
      next(new Error('認証トークンがありません'));
      return;
    }
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error('トークンが無効です'));
    }
  });

  setIo(io);

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    logger.info('Socket connected', { userId, socketId: socket.id });

    registerMessageHandlers(io, socket, userId);
    registerPresenceHandlers(io, socket, userId);
  });

  return io;
}
