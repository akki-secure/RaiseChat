import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

import ThreadPane from './ThreadPane';

describe('ThreadPane', () => {
  it('スレッド専用の API を呼び、返信を表示する', async () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();   // テスト環境にない機能の偽物
    get.mockResolvedValue({
      replies: [{ id: 'r1', user_id: 'u1', content: '返信です', created_at: '2026-11-26T00:00:00Z' }],
    });

    render(<ThreadPane channelId="c1" parentId="m1" />);

    expect(await screen.findByText('返信です')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/channels/c1/messages/m1/thread');
  });
});
