import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Socket } from 'socket.io-client';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/features/notifications/notificationSound', () => ({ playNotificationSound: vi.fn() }));

import { useModerationEvents } from './useModerationEvents';
import { useAppStore } from '@/stores/useAppStore';
import { useNotificationStore } from '@/features/notifications/useNotificationStore';

function fakeSocket() {
  const handlers: Record<string, (e: unknown) => void> = {};
  return {
    handlers,
    socket: {
      on: (ev: string, fn: (e: unknown) => void) => { handlers[ev] = fn; },
      off: (ev: string) => { delete handlers[ev]; },
    } as unknown as Socket,
  };
}

const ws = (id: string) => ({ id, name: id, owner_id: 'o', invite_code: 'c', role: 'member' as const });

beforeEach(() => {
  replace.mockReset();
  useNotificationStore.setState({ notifications: [] });
  useAppStore.setState({ workspaces: [ws('w1'), ws('w2')] });
});

describe('useModerationEvents', () => {
  it('警告を受けると通知する', () => {
    const { handlers, socket } = fakeSocket();
    renderHook(() => useModerationEvents(socket));
    handlers['member:warned']({ workspace_id: 'w1', reason: '人格否定', count: 2, threshold: 3 });
    const n = useNotificationStore.getState().notifications[0];
    expect(n.title).toContain('警告');
    expect(n.body).toContain('2/3');
  });

  it('キックされると、そのワークスペースを一覧から外して別のワークスペースへ移動する', () => {
    const { handlers, socket } = fakeSocket();
    renderHook(() => useModerationEvents(socket));
    handlers['member:kicked']({ workspace_id: 'w1', reason: '警告3回' });
    expect(useAppStore.getState().workspaces.map((w) => w.id)).toEqual(['w2']);
    expect(replace).toHaveBeenCalledWith('/workspace/w2');
  });

  it('最後のワークスペースからキックされたら新規作成画面へ移動する', () => {
    useAppStore.setState({ workspaces: [ws('w1')] });
    const { handlers, socket } = fakeSocket();
    renderHook(() => useModerationEvents(socket));
    handlers['member:kicked']({ workspace_id: 'w1', reason: 'x' });
    expect(replace).toHaveBeenCalledWith('/workspace/new');
  });

  it('アンマウントでイベントの購読を解除する', () => {
    const { handlers, socket } = fakeSocket();
    const { unmount } = renderHook(() => useModerationEvents(socket));
    unmount();
    expect(handlers['member:warned']).toBeUndefined();
    expect(handlers['member:kicked']).toBeUndefined();
  });
});
