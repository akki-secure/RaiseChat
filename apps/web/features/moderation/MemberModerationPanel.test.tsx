import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }));

import MemberModerationPanel from './MemberModerationPanel';
import { canKickNow } from './types';

const WID = 'w1';
let activeCount = 0;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  activeCount = 0;
  post.mockResolvedValue({});
  get.mockImplementation(async (path: string) => {
    if (path === `/workspaces/${WID}/members`) {
      return { members: [
        { id: 'me', username: 'owner', display_name: null, role: 'owner' },
        { id: 'u2', username: 'hanako', display_name: null, role: 'member' },
      ] };
    }
    if (path.endsWith('/members/removed')) {
      return { members: [{ id: 'u3', username: 'jiro', display_name: null, removed_at: '2026-11-15', removed_reason: '荒らし' }] };
    }
    if (path.endsWith('/warnings')) return { warnings: [], active_count: activeCount, threshold: 3 };
    return {};
  });
});

describe('canKickNow', () => {
  it('警告が閾値未満で重大違反でなければ不可', () => expect(canKickNow(2, 3, false)).toBe(false));
  it('閾値に達していれば可', () => expect(canKickNow(3, 3, false)).toBe(true));
  it('重大違反なら可', () => expect(canKickNow(0, 3, true)).toBe(true));
});

describe('MemberModerationPanel', () => {
  it('自分とオーナーは対象に出ず、キック済みが表示される', async () => {
    render(<MemberModerationPanel workspaceId={WID} meId="me" />);
    expect(await screen.findByText('hanako')).toBeTruthy();
    expect(screen.queryByText('owner')).toBeNull();
    expect(screen.getByText('jiro')).toBeTruthy();
  });

  it('警告が足りないとキック実行できず、重大違反にチェックすると実行できる', async () => {
    activeCount = 1;
    render(<MemberModerationPanel workspaceId={WID} meId="me" />);
    await screen.findByText('hanako');
    await waitFor(() => expect(screen.getByTestId('count-u2').textContent).toContain('1/3'));

    fireEvent.click(screen.getByRole('button', { name: 'キック' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '人格否定' } });
    const submit = screen.getByRole('button', { name: 'キックする' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/workspaces/${WID}/members/u2/kick`, { reason: '人格否定', severe: true })
    );
  });

  it('警告が閾値に達していれば、重大違反でなくてもキックできる', async () => {
    activeCount = 3;
    render(<MemberModerationPanel workspaceId={WID} meId="me" />);
    await waitFor(() => expect(screen.getByTestId('count-u2').textContent).toContain('3/3'));
    fireEvent.click(screen.getByRole('button', { name: 'キック' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '警告を無視' } });
    expect((screen.getByRole('button', { name: 'キックする' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('理由が空なら警告できない', async () => {
    render(<MemberModerationPanel workspaceId={WID} meId="me" />);
    await screen.findByText('hanako');
    fireEvent.click(screen.getByRole('button', { name: '警告' }));
    expect((screen.getByRole('button', { name: '警告する' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('キック解除を押すと unkick を呼ぶ', async () => {
    render(<MemberModerationPanel workspaceId={WID} meId="me" />);
    fireEvent.click(await screen.findByRole('button', { name: 'キック解除' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/workspaces/${WID}/members/u3/unkick`, {}));
  });
});
