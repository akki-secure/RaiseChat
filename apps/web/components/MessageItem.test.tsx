import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageItem from './MessageItem';
import type { Message } from '@/stores/useAppStore';

function makeMessage(attachments: Message['attachments']): Message {
  return {
    id: 'm1',
    channel_id: 'c1',
    user_id: 'u1',
    content: '',
    parent_id: null,
    edited_at: null,
    deleted_at: null,
    created_at: '2026-11-07T00:00:00Z',
    username: 'tester',
    attachments,
  };
}

describe('MessageItem の添付表示', () => {
  it('動画は <video> でインライン表示し、controls が付く', () => {
    const { container } = render(
      <MessageItem
        channelId="c1"
        msg={makeMessage([{ id: 'a1', url: 'https://x/uploads/a.mp4', file_type: 'video/mp4', size: 100 }])}
      />
    );
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', 'https://x/uploads/a.mp4');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(screen.queryByText(/ファイルを開く/)).not.toBeInTheDocument();
  });

  it('画像は <img>、動画以外のファイルはリンクのまま表示する', () => {
    render(
      <MessageItem
        channelId="c1"
        msg={makeMessage([
          { id: 'a1', url: 'https://x/uploads/a.png', file_type: 'image/png', size: 100 },
          { id: 'a2', url: 'https://x/uploads/b.pdf', file_type: 'application/pdf', size: 100 },
        ])}
      />
    );
    expect(screen.getByRole('img', { name: 'attachment' })).toHaveAttribute('src', 'https://x/uploads/a.png');
    expect(screen.getByRole('link', { name: /ファイルを開く/ })).toHaveAttribute('href', 'https://x/uploads/b.pdf');
  });
});
