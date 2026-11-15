import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { useAppStore } from '@/stores/useAppStore';
import { useNotificationStore } from '@/features/notifications/useNotificationStore';

interface WarnedEvent { workspace_id: string; reason: string; count: number; threshold: number }
interface KickedEvent { workspace_id: string; reason: string }

// 警告を受けたら通知し、キックされたらそのワークスペースから外して移動する
export function useModerationEvents(socket: Socket | null) {
  const router = useRouter();
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!socket) return;

    const onWarned = (e: WarnedEvent) => {
      addNotification({
        type: 'new',
        title: '管理者から警告を受けました',
        body: `${e.reason}（${e.count}/${e.threshold}回）`,
        href: `/workspace/${e.workspace_id}`,
      });
    };

    const onKicked = (e: KickedEvent) => {
      const { workspaces, setWorkspaces } = useAppStore.getState();
      const rest = workspaces.filter((w) => w.id !== e.workspace_id);
      setWorkspaces(rest);
      addNotification({
        type: 'new',
        title: 'ワークスペースから削除されました',
        body: e.reason,
      });
      router.replace(rest.length > 0 ? `/workspace/${rest[0].id}` : '/workspace/new');
    };

    socket.on('member:warned', onWarned);
    socket.on('member:kicked', onKicked);
    return () => {
      socket.off('member:warned', onWarned);
      socket.off('member:kicked', onKicked);
    };
  }, [socket, router, addNotification]);
}
