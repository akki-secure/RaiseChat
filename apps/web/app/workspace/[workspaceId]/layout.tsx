'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, User } from '@/stores/useAppStore';
import { getSocket } from '@/lib/socket';
import { usePresence } from '@/hooks/usePresence';
import { useModerationEvents } from '@/features/moderation/useModerationEvents';
import { useNotificationStore } from '@/features/notifications/useNotificationStore';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/features/notifications/TopBar';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, setMe } = useAppStore();

  // 認証チェック
  useEffect(() => {
    if (me) return;
    api
      .get<{ user: User }>('/auth/me')
      .then(({ user }) => setMe(user))
      .catch(() => router.replace('/auth/login'));
  }, [me, setMe, router]);

  // Socket.io 接続（tokenはcookieベースなので空文字でOK）
  const socket = me ? getSocket('') : null;
  usePresence(socket);
  useModerationEvents(socket);

  const { addNotification } = useNotificationStore();

  // DM 着信通知
  useEffect(() => {
    if (!socket || !me) return;
    const onDm = (msg: {
      sender_id: string;
      content: string;
      workspace_id: string;
      username: string;
      display_name?: string;
    }) => {
      addNotification({
        type: 'new',
        title: `${msg.display_name ?? msg.username} からDM`,
        body: msg.content,
        href: `/workspace/${msg.workspace_id}/dm/${msg.sender_id}`,
      });
    };
    socket.on('dm:new', onDm);
    return () => { socket.off('dm:new', onDm); };
  }, [socket, me, addNotification]);

  // チャンネルの新着通知（開いているチャンネルは通知しない）
  useEffect(() => {
    if (!socket || !me) return;
    const onNotify = (msg: {
      workspace_id: string;
      channel_id: string;
      channel_name: string;
      content: string;
    }) => {
      const href = `/workspace/${msg.workspace_id}/channel/${msg.channel_id}`;
      if (pathname === href) return;
      const mentioned = msg.content.includes(`@${me.username}`);
      addNotification({
        type: 'new',
        title: mentioned ? `メンション（#${msg.channel_name}）` : `#${msg.channel_name}`,
        body: msg.content,
        href,
      });
    };
    socket.on('message:notify', onNotify);
    return () => { socket.off('message:notify', onNotify); };
  }, [socket, me, pathname, addNotification]);

  if (!me) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
