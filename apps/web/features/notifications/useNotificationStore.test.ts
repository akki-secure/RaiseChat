import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotificationStore } from './useNotificationStore';

// AudioContext は jsdom に存在しないためモック
vi.mock('./notificationSound', () => ({
  playNotificationSound: vi.fn(),
}));

beforeEach(() => {
  useNotificationStore.setState({ notifications: [] });
});

const baseNotif = { type: 'new' as const, title: 'テスト', body: 'メッセージ本文' };

describe('useNotificationStore', () => {
  it('addNotification で通知が追加される', () => {
    useNotificationStore.getState().addNotification(baseNotif);
    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('テスト');
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].id).toBeTruthy();
  });

  it('addNotification で複数追加すると新しい順になる', () => {
    useNotificationStore.getState().addNotification({ ...baseNotif, title: '1件目' });
    useNotificationStore.getState().addNotification({ ...baseNotif, title: '2件目' });
    const { notifications } = useNotificationStore.getState();
    expect(notifications[0].title).toBe('2件目');
    expect(notifications[1].title).toBe('1件目');
  });

  it('markRead で指定した通知が既読になる', () => {
    useNotificationStore.getState().addNotification(baseNotif);
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().markRead(id);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it('markAllRead で全通知が既読になる', () => {
    useNotificationStore.getState().addNotification(baseNotif);
    useNotificationStore.getState().addNotification(baseNotif);
    useNotificationStore.getState().markAllRead();
    const allRead = useNotificationStore.getState().notifications.every((n) => n.read);
    expect(allRead).toBe(true);
  });

  it('remove で指定した通知が削除される', () => {
    useNotificationStore.getState().addNotification(baseNotif);
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().remove(id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('clearAll で全通知が削除される', () => {
    useNotificationStore.getState().addNotification(baseNotif);
    useNotificationStore.getState().addNotification(baseNotif);
    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('unreadCount で未読数が返る', () => {
    useNotificationStore.getState().addNotification(baseNotif);
    useNotificationStore.getState().addNotification(baseNotif);
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().markRead(id);
    expect(useNotificationStore.getState().unreadCount()).toBe(1);
  });
});
