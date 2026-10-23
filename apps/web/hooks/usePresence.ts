import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useAppStore } from '@/stores/useAppStore';

export function usePresence(socket: Socket | null) {
  const { setOnlineUserIds, setUserOnline, setUserOffline } = useAppStore();

  useEffect(() => {
    if (!socket) return;

    const onSnapshot = (ids: string[]) => setOnlineUserIds(ids);
    const onOnline = (id: string) => setUserOnline(id);
    const onOffline = (id: string) => setUserOffline(id);

    socket.on('presence:snapshot', onSnapshot);
    socket.on('presence:online', onOnline);
    socket.on('presence:offline', onOffline);

    return () => {
      socket.off('presence:snapshot', onSnapshot);
      socket.off('presence:online', onOnline);
      socket.off('presence:offline', onOffline);
    };
  }, [socket, setOnlineUserIds, setUserOnline, setUserOffline]);
}
