import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

beforeEach(() => {
  useAppStore.setState({
    me: null,
    workspaces: [],
    activeWorkspaceId: null,
    channels: [],
    activeChannelId: null,
    messages: {},
    threadParentId: null,
    onlineUserIds: new Set(),
    dmPartnerIds: [],
  });
});

describe('useAppStore', () => {
  it('setMe でユーザーをセットできる', () => {
    const user = { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: null, status: 'online' as const };
    useAppStore.getState().setMe(user);
    expect(useAppStore.getState().me).toEqual(user);
  });

  it('appendMessage でメッセージを追加できる', () => {
    const msg = {
      id: 'm1', channel_id: 'ch1', user_id: 'u1', content: 'hello',
      parent_id: null, edited_at: null, deleted_at: null, created_at: '2026-01-01T00:00:00Z',
    };
    useAppStore.getState().appendMessage('ch1', msg);
    expect(useAppStore.getState().messages['ch1']).toHaveLength(1);
    expect(useAppStore.getState().messages['ch1'][0].content).toBe('hello');
  });

  it('softDeleteMessage で deleted_at がセットされる', () => {
    const msg = {
      id: 'm1', channel_id: 'ch1', user_id: 'u1', content: 'hello',
      parent_id: null, edited_at: null, deleted_at: null, created_at: '2026-01-01T00:00:00Z',
    };
    useAppStore.getState().appendMessage('ch1', msg);
    useAppStore.getState().softDeleteMessage('ch1', 'm1');
    const stored = useAppStore.getState().messages['ch1'][0];
    expect(stored.deleted_at).not.toBeNull();
  });

  it('addReaction でリアクションを追加できる', () => {
    const msg = {
      id: 'm1', channel_id: 'ch1', user_id: 'u1', content: 'hello',
      parent_id: null, edited_at: null, deleted_at: null, created_at: '2026-01-01T00:00:00Z',
      reactions: [],
    };
    useAppStore.getState().appendMessage('ch1', msg);
    useAppStore.getState().addReaction('ch1', 'm1', '👍');
    const reactions = useAppStore.getState().messages['ch1'][0].reactions!;
    expect(reactions).toHaveLength(1);
    expect(reactions[0]).toEqual({ emoji: '👍', count: 1, reacted: true });
  });

  it('removeReaction でカウントが0になるとリアクションが消える', () => {
    const msg = {
      id: 'm1', channel_id: 'ch1', user_id: 'u1', content: 'hello',
      parent_id: null, edited_at: null, deleted_at: null, created_at: '2026-01-01T00:00:00Z',
      reactions: [{ emoji: '👍', count: 1, reacted: true }],
    };
    useAppStore.getState().appendMessage('ch1', msg);
    useAppStore.getState().removeReaction('ch1', 'm1', '👍');
    const reactions = useAppStore.getState().messages['ch1'][0].reactions!;
    expect(reactions).toHaveLength(0);
  });

  it('setUserOnline / setUserOffline でオンライン状態を管理できる', () => {
    useAppStore.getState().setUserOnline('u1');
    expect(useAppStore.getState().onlineUserIds.has('u1')).toBe(true);

    useAppStore.getState().setUserOffline('u1');
    expect(useAppStore.getState().onlineUserIds.has('u1')).toBe(false);
  });

  it('setActiveWorkspace でチャンネルとメッセージがリセットされる', () => {
    useAppStore.getState().setChannels([{ id: 'ch1', workspace_id: 'ws1', name: 'general', type: 'public', created_by: 'u1' }]);
    useAppStore.getState().appendMessage('ch1', {
      id: 'm1', channel_id: 'ch1', user_id: 'u1', content: 'hello',
      parent_id: null, edited_at: null, deleted_at: null, created_at: '2026-01-01T00:00:00Z',
    });
    useAppStore.getState().setActiveWorkspace('ws2');
    expect(useAppStore.getState().channels).toHaveLength(0);
    expect(useAppStore.getState().messages).toEqual({});
  });
});
