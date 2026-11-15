import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const post = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...a: unknown[]) => post(...a) } }));

import CreateChannelModal from './CreateChannelModal';
import JoinChannelBar from './JoinChannelBar';

beforeEach(() => {
  post.mockReset();
});

describe('CreateChannelModal', () => {
  it('不正な名前では作成できない', async () => {
    render(<CreateChannelModal workspaceId="w1" onCreated={vi.fn()} onClose={vi.fn()} />);
    const input = await screen.findByPlaceholderText('random');
    const btn = screen.getByRole('button', { name: '作成する' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Random チャンネル' } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'random' } });
    expect(btn.disabled).toBe(false);
  });

  it('作成すると API を呼び、onCreated にチャンネルを渡す', async () => {
    const ch = { id: 'c1', name: 'random' };
    post.mockResolvedValue({ channel: ch });
    const onCreated = vi.fn();
    render(<CreateChannelModal workspaceId="w1" onCreated={onCreated} onClose={vi.fn()} />);
    fireEvent.change(await screen.findByPlaceholderText('random'), { target: { value: 'random' } });
    fireEvent.click(screen.getByRole('button', { name: '作成する' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(ch));
    expect(post).toHaveBeenCalledWith('/workspaces/w1/channels', { name: 'random', type: 'public' });
  });

  it('失敗したらエラーを表示する', async () => {
    post.mockRejectedValue(new Error('同じ名前のチャンネルがあります'));
    render(<CreateChannelModal workspaceId="w1" onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(await screen.findByPlaceholderText('random'), { target: { value: 'general' } });
    fireEvent.click(screen.getByRole('button', { name: '作成する' }));
    expect(await screen.findByText('同じ名前のチャンネルがあります')).toBeTruthy();
  });
});

describe('JoinChannelBar', () => {
  it('参加するを押すと join API を呼び、onJoined を呼ぶ', async () => {
    post.mockResolvedValue({});
    const onJoined = vi.fn();
    render(<JoinChannelBar workspaceId="w1" channelId="c1" onJoined={onJoined} />);
    fireEvent.click(screen.getByRole('button', { name: '参加する' }));
    await waitFor(() => expect(onJoined).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/workspaces/w1/channels/c1/join', {});
  });
});
