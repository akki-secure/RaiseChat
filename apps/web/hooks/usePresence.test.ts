import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresence } from './usePresence';
import { useAppStore } from '@/stores/useAppStore';

function makeSocket() {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    }),
    off: vi.fn(),
    emit: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
}

beforeEach(() => {
  useAppStore.setState({ onlineUserIds: new Set() });
});

describe('usePresence', () => {
  it('socket が null のとき何もしない', () => {
    const { unmount } = renderHook(() => usePresence(null));
    expect(useAppStore.getState().onlineUserIds.size).toBe(0);
    unmount();
  });

  it('presence:snapshot でオンラインユーザーIDがセットされる', () => {
    const socket = makeSocket();
    renderHook(() => usePresence(socket as never));

    act(() => { socket.emit('presence:snapshot', ['u1', 'u2', 'u3']); });
    expect(useAppStore.getState().onlineUserIds).toEqual(new Set(['u1', 'u2', 'u3']));
  });

  it('presence:online でユーザーが追加される', () => {
    const socket = makeSocket();
    renderHook(() => usePresence(socket as never));

    act(() => { socket.emit('presence:online', 'u4'); });
    expect(useAppStore.getState().onlineUserIds.has('u4')).toBe(true);
  });

  it('presence:offline でユーザーが削除される', () => {
    useAppStore.setState({ onlineUserIds: new Set(['u1', 'u2']) });
    const socket = makeSocket();
    renderHook(() => usePresence(socket as never));

    act(() => { socket.emit('presence:offline', 'u1'); });
    expect(useAppStore.getState().onlineUserIds.has('u1')).toBe(false);
    expect(useAppStore.getState().onlineUserIds.has('u2')).toBe(true);
  });

  it('アンマウント時にリスナーが解除される', () => {
    const socket = makeSocket();
    const { unmount } = renderHook(() => usePresence(socket as never));

    unmount();
    expect(socket.off).toHaveBeenCalledWith('presence:snapshot', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('presence:online', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('presence:offline', expect.any(Function));
  });
});
