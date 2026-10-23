import { Server } from 'socket.io';

let _io: Server | null = null;

export function setIo(io: Server) {
  _io = io;
}

export function getIo(): Server {
  if (!_io) throw new Error('Socket.io はまだ初期化されていません');
  return _io;
}
