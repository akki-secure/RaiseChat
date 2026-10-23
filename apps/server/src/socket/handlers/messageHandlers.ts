import { Server, Socket } from 'socket.io';
import pool from '../../config/db.js';
import logger from '../../utils/logger.js';

export function registerMessageHandlers(io: Server, socket: Socket, userId: string) {
  // チャンネルに参加
  socket.on('channel:join', (channelId: string) => {
    socket.join(`channel:${channelId}`);
  });

  // チャンネルから退出
  socket.on('channel:leave', (channelId: string) => {
    socket.leave(`channel:${channelId}`);
  });

  // メッセージ送信 (WebSocket経由)
  socket.on('send_message', async (data: { channelId: string; content: string; parentId?: string }) => {
    try {
      const { channelId, content, parentId } = data;

      const memberCheck = await pool.query(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      if (!memberCheck.rows[0]) return;

      const result = await pool.query(
        `INSERT INTO messages (channel_id, user_id, content, parent_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, channel_id, user_id, content, parent_id, created_at`,
        [channelId, userId, content, parentId ?? null]
      );

      const userResult = await pool.query(
        'SELECT username, display_name, avatar_url FROM users WHERE id = $1',
        [userId]
      );

      const message = { ...result.rows[0], ...userResult.rows[0] };
      io.to(`channel:${channelId}`).emit('message:new', message);
    } catch (err) {
      logger.error('send_message error', { err, userId });
    }
  });

  // タイピング開始
  socket.on('typing_start', (channelId: string) => {
    socket.to(`channel:${channelId}`).emit('typing', { userId, channelId, typing: true });
  });

  // タイピング停止
  socket.on('typing_stop', (channelId: string) => {
    socket.to(`channel:${channelId}`).emit('typing', { userId, channelId, typing: false });
  });
}
