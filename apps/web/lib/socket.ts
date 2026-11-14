import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  // 接続済み・接続中・再接続待ちの接続は使い回す（呼ぶたびに新しい接続を作らない）。
  // 拒否された接続や、自分で閉じた接続は active が false なので作り直す
  if (socket && (socket.connected || socket.active)) return socket;

  socket = io(process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000', {
    auth: { token },
    withCredentials: true,
    transports: ['websocket'],
  });

  return socket;
}

/** ログアウト時に呼ぶ。次にログインした人は、新しい接続で始まる */
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
