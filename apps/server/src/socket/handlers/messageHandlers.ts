import { Server, Socket } from 'socket.io';

export function registerMessageHandlers(io: Server, socket: Socket, userId: string) {
  // チャンネルに参加
  socket.on('channel:join', (channelId: string) => {
    socket.join(`channel:${channelId}`);
  });

  // チャンネルから退出
  socket.on('channel:leave', (channelId: string) => {
    socket.leave(`channel:${channelId}`);
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
