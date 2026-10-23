import { Server, Socket } from 'socket.io';
import pool from '../../config/db.js';
import logger from '../../utils/logger.js';

export function registerPresenceHandlers(io: Server, socket: Socket, userId: string) {
  // ステータス変更
  socket.on('update_status', async (status: string) => {
    const allowed = ['online', 'away', 'busy', 'offline'];
    if (!allowed.includes(status)) return;

    try {
      await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);
      // 同じワークスペースのメンバー全員に通知
      io.emit('presence_update', { userId, status });
    } catch (err) {
      logger.error('update_status error', { err, userId });
    }
  });

  // 切断時にオフラインへ
  socket.on('disconnect', async () => {
    try {
      await pool.query("UPDATE users SET status = 'offline' WHERE id = $1", [userId]);
      io.emit('presence_update', { userId, status: 'offline' });
    } catch (err) {
      logger.error('disconnect cleanup error', { err, userId });
    }
  });
}
