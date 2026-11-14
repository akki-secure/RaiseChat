import { Server, Socket } from 'socket.io';
import pool from '../../config/db.js';
import logger from '../../utils/logger.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roomOf = (channelId: string) => `channel:${channelId}`;

export function registerMessageHandlers(io: Server, socket: Socket, userId: string) {
  // チャンネルに参加（そのチャンネルのメンバーで、削除されていない場合だけ）
  socket.on('channel:join', async (channelId: unknown) => {
    if (typeof channelId !== 'string' || !UUID_RE.test(channelId)) return;
    try {
      const result = await pool.query(
        `SELECT 1 FROM channel_members cm
         JOIN channels c ON c.id = cm.channel_id
         WHERE cm.channel_id = $1 AND cm.user_id = $2 AND c.deleted_at IS NULL`,
        [channelId, userId]
      );
      if (result.rows[0]) socket.join(roomOf(channelId));
    } catch (err) {
      logger.error('channel:join error', { err, userId });
    }
  });

  // チャンネルから退出
  socket.on('channel:leave', (channelId: unknown) => {
    if (typeof channelId !== 'string') return;
    socket.leave(roomOf(channelId));
  });

  // タイピング開始・停止（参加済みのチャンネルだけ。参加していない部屋へは送れない）
  socket.on('typing_start', (channelId: unknown) => {
    if (typeof channelId !== 'string' || !socket.rooms.has(roomOf(channelId))) return;
    socket.to(roomOf(channelId)).emit('typing', { userId, channelId, typing: true });
  });

  socket.on('typing_stop', (channelId: unknown) => {
    if (typeof channelId !== 'string' || !socket.rooms.has(roomOf(channelId))) return;
    socket.to(roomOf(channelId)).emit('typing', { userId, channelId, typing: false });
  });
}
