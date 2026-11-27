import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const del = vi.fn();
vi.mock('@/lib/api', () => ({ api: { delete: (...a: unknown[]) => del(...a) } }));

import MessageItem from './MessageItem';
import { useAppStore, type Message } from '@/stores/useAppStore';

const msg: Message = {
  id: 'm1',
  channel_id: 'c1',
  user_id: 'u1',
  content: '本文',
  parent_id: null,
  edited_at: null,
  deleted_at: null,
  created_at: '2026-11-27T00:00:00Z',
  username: 'tester',
};

function clickDelete() {
  fireEvent.mouseEnter(screen.getByText('本文').closest('.group')!);
  fireEvent.click(screen.getByRole('button', { name: '削除' }));
}

const stored = () => useAppStore.getState().messages['c1'][0];

beforeEach(() => {
  del.mockReset();
  useAppStore.setState({
    me: { id: 'u1', username: 'tester', display_name: null, avatar_url: null, status: 'online' },
    messages: { c1: [msg] },
  });
});

describe('MessageItem の削除', () => {
  it('チャンネル配下の API を呼び、成功したら削除済みにする', async () => {
    del.mockResolvedValue({});
    render(<MessageItem channelId="c1" msg={msg} />);
    clickDelete();
    await waitFor(() => expect(stored().deleted_at).not.toBeNull());
    expect(del).toHaveBeenCalledWith('/channels/c1/messages/m1');
  });

  it('失敗したら削除済みにせず、エラーを表示する', async () => {
    del.mockRejectedValue(new Error('failed'));
    render(<MessageItem channelId="c1" msg={msg} />);
    clickDelete();
    expect(await screen.findByRole('alert')).toHaveTextContent('削除できませんでした');
    expect(stored().deleted_at).toBeNull();
  });

  it('削除の通信中はボタンを押せず、API は1回だけ呼ぶ', () => {
    del.mockReturnValue(new Promise(() => {}));   // 応答が返らない状態を作る
    render(<MessageItem channelId="c1" msg={msg} />);
    clickDelete();
    const button = screen.getByRole('button', { name: '削除' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('削除済みのメッセージは添付とリアクションを表示しない', () => {
    const { container } = render(
      <MessageItem
        channelId="c1"
        msg={{
          ...msg,
          deleted_at: '2026-11-27T01:00:00Z',
          attachments: [{ id: 'a1', url: 'https://x/uploads/a.png', file_type: 'image/png', size: 1 }],
          reactions: [{ emoji: '👍', count: 1, reacted: false }],
        }}
      />
    );
    expect(screen.getByText('このメッセージは削除されました')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button', { name: /👍/ })).toBeNull();
  });
});
