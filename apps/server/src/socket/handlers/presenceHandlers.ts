import { Server, Socket } from 'socket.io';
import pool from '../../config/db.js';
import logger from '../../utils/logger.js';

export function registerPresenceHandlers(io: Server, socket: Socket, userId: string) {
  // 接続時: 今オンラインの人の一覧を本人に送り、全員に「この人がオンライン」と知らせる
  // （同じ人が2回届いても、クライアントは Set で持つので問題ない）
  void (async () => {
    try {
      const sockets = await io.fetchSockets();
      const onlineIds = [...new Set(sockets.map((s) => s.data.userId as string))];
      socket.emit('presence:snapshot', onlineIds);
      io.emit('presence:online', userId);
    } catch (err) {
      logger.error('presence connect error', { err, userId });
    }
  })();

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

  // 切断時: 同じユーザーの接続（別タブなど）が残っていなければオフラインへ
  socket.on('disconnect', async () => {
    try {
      const remaining = await io.in(`user:${userId}`).fetchSockets();
      if (remaining.length > 0) return;

      await pool.query("UPDATE users SET status = 'offline' WHERE id = $1", [userId]);
      io.emit('presence:offline', userId);
      io.emit('presence_update', { userId, status: 'offline' });
    } catch (err) {
      logger.error('disconnect cleanup error', { err, userId });
    }
  });
}
