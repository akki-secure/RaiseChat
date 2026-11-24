import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Server, Socket } from 'socket.io';

const query = vi.fn();
vi.mock('../../config/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));
vi.mock('../../utils/logger.js', () => ({ default: { error: vi.fn(), info: vi.fn() } }));

import { registerPresenceHandlers } from './presenceHandlers.js';

// 偽の io。fetchSockets は「全体」と「user:xxx の部屋」で返す値を変えられる
function makeEnv(opts: { all?: string[]; remaining?: number } = {}) {
  const ioEmit = vi.fn();
  const io = {
    emit: ioEmit,
    fetchSockets: vi.fn(async () => (opts.all ?? []).map((id) => ({ data: { userId: id } }))),
    in: vi.fn(() => ({ fetchSockets: vi.fn(async () => Array(opts.remaining ?? 0).fill({})) })),
  };
  const handlers: Record<string, (arg?: unknown) => Promise<void>> = {};
  const socket = {
    emit: vi.fn(),
    on: (name: string, fn: (arg?: unknown) => Promise<void>) => { handlers[name] = fn; },
  };
  registerPresenceHandlers(io as unknown as Server, socket as unknown as Socket, 'u1');
  return { io, ioEmit, socket, handlers };
}

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [] });
});

describe('接続時', () => {
  it('本人に snapshot（重複なし）、全員に presence:online を送る', async () => {
    const { socket, ioEmit } = makeEnv({ all: ['u1', 'u2', 'u2'] });
    await vi.waitFor(() => expect(socket.emit).toHaveBeenCalled());

    expect(socket.emit).toHaveBeenCalledWith('presence:snapshot', ['u1', 'u2']);
    expect(ioEmit).toHaveBeenCalledWith('presence:online', 'u1');
  });
});

describe('切断時', () => {
  it('別タブが残っていれば、DB更新も通知もしない', async () => {
    const { handlers, ioEmit } = makeEnv({ remaining: 1 });
    await handlers['disconnect']();

    expect(query).not.toHaveBeenCalled();
    expect(ioEmit).not.toHaveBeenCalledWith('presence:offline', 'u1');
  });

  it('最後の接続なら、DBを offline にして presence:offline と presence_update を送る', async () => {
    const { handlers, ioEmit } = makeEnv({ remaining: 0 });
    await handlers['disconnect']();

    expect(String(query.mock.calls[0][0])).toContain("status = 'offline'");
    expect(query.mock.calls[0][1]).toEqual(['u1']);
    expect(ioEmit).toHaveBeenCalledWith('presence:offline', 'u1');
    expect(ioEmit).toHaveBeenCalledWith('presence_update', { userId: 'u1', status: 'offline' });
  });
});

describe('update_status', () => {
  it('許可された値なら DB 更新して presence_update を送る', async () => {
    const { handlers, ioEmit } = makeEnv();
    await handlers['update_status']('busy');

    expect(query).toHaveBeenCalledWith('UPDATE users SET status = $1 WHERE id = $2', ['busy', 'u1']);
    expect(ioEmit).toHaveBeenCalledWith('presence_update', { userId: 'u1', status: 'busy' });
  });

  it('許可されない値は何もしない', async () => {
    const { handlers, ioEmit } = makeEnv();
    await handlers['update_status']('hacked');

    expect(query).not.toHaveBeenCalled();
    expect(ioEmit).not.toHaveBeenCalledWith('presence_update', expect.anything());
  });
});
