import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMessages } from './useMessages';
import { useAppStore } from '@/stores/useAppStore';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api';
const mockGet = vi.mocked(api.get);

const makeMsg = (id: string, created_at: string) => ({
  id,
  channel_id: 'ch1',
  user_id: 'u1',
  content: `msg ${id}`,
  parent_id: null,
  edited_at: null,
  deleted_at: null,
  created_at,
});

beforeEach(() => {
  useAppStore.setState({ messages: {} });
  mockGet.mockClear();
});

describe('useMessages', () => {
  it('channelId が null のとき API を呼ばない', () => {
    renderHook(() => useMessages(null));
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('チャンネル切り替え時にメッセージを取得してストアにセットする', async () => {
    const msgs = [makeMsg('m1', '2026-01-01T00:00:00Z'), makeMsg('m2', '2026-01-02T00:00:00Z')];
    mockGet.mockResolvedValue({ messages: msgs });

    const { result } = renderHook(() => useMessages('ch1'));

    await waitFor(() => {
      expect(useAppStore.getState().messages['ch1']).toHaveLength(2);
    });
    expect(result.current.msgs).toHaveLength(2);
    expect(mockGet).toHaveBeenCalledWith('/channels/ch1/messages?limit=50');
  });

  it('取得件数が PAGE_SIZE 未満のとき hasMore が false になる', async () => {
    const msgs = [makeMsg('m1', '2026-01-01T00:00:00Z')];
    mockGet.mockResolvedValue({ messages: msgs });

    const { result } = renderHook(() => useMessages('ch1'));

    await waitFor(() => {
      expect(useAppStore.getState().messages['ch1']).toHaveLength(1);
    });
    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore で古いメッセージを先頭に追加する', async () => {
    const initial = Array.from({ length: 50 }, (_, i) =>
      makeMsg(`m${i + 51}`, `2026-01-${String(i + 51).padStart(2, '0')}T00:00:00Z`)
    );
    const older = [makeMsg('m1', '2026-01-01T00:00:00Z')];

    mockGet
      .mockResolvedValueOnce({ messages: initial })
      .mockResolvedValueOnce({ messages: older });

    const { result } = renderHook(() => useMessages('ch1'));
    await waitFor(() => expect(useAppStore.getState().messages['ch1']).toHaveLength(50));

    await act(() => result.current.loadMore());

    await waitFor(() => {
      expect(useAppStore.getState().messages['ch1']).toHaveLength(51);
    });
    expect(useAppStore.getState().messages['ch1'][0].id).toBe('m1');
  });

  it('hasMore が false のとき loadMore は API を呼ばない', async () => {
    mockGet.mockResolvedValue({ messages: [makeMsg('m1', '2026-01-01T00:00:00Z')] });

    const { result } = renderHook(() => useMessages('ch1'));
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    mockGet.mockClear();
    await act(() => result.current.loadMore());
    expect(mockGet).not.toHaveBeenCalled();
  });
});
