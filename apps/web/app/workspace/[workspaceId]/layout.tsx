'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, User } from '@/stores/useAppStore';
import { getSocket } from '@/lib/socket';
import { usePresence } from '@/hooks/usePresence';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/features/notifications/TopBar';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
