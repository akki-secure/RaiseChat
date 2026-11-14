import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Server, Socket } from 'socket.io';

const query = vi.fn();
vi.mock('../../config/db.js', () => ({ default: { query: (...a: unknown[]) => query(...a) } }));
vi.mock('../../utils/logger.js', () => ({ default: { error: vi.fn(), info: vi.fn() } }));

import { registerMessageHandlers } from './messageHandlers.js';

const CID = '55555555-5555-4555-8555-555555555555';
const ROOM = `channel:${CID}`;

// socket.io の Socket の代わりに、必要な部分だけを持つ偽物を使う
function makeSocket() {
  const handlers: Record<string, (arg: unknown) => unknown> = {};
  const emit = vi.fn();
  const rooms = new Set<string>();
  const socket = {
    rooms,
    on: (name: string, fn: (arg: unknown) => unknown) => { handlers[name] = fn; },
    join: vi.fn((room: string) => { rooms.add(room); }),
    leave: vi.fn((room: string) => { rooms.delete(room); }),
    to: vi.fn(() => ({ emit })),
  };
  registerMessageHandlers({} as Server, socket as unknown as Socket, 'u1');
  return { socket, handlers, emit };
}

beforeEach(() => { query.mockReset(); });

describe('channel:join', () => {
  it('メンバーなら参加できる（削除されていないチャンネルだけを対象に確認する）', async () => {
    query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const { socket, handlers } = makeSocket();

    await handlers['channel:join'](CID);

    expect(socket.join).toHaveBeenCalledWith(ROOM);
    expect(String(query.mock.calls[0][0])).toContain('deleted_at IS NULL');
    expect(query.mock.calls[0][1]).toEqual([CID, 'u1']);
  });

  it('メンバーでなければ参加できない', async () => {
    query.mockResolvedValue({ rows: [] });
    const { socket, handlers } = makeSocket();

    await handlers['channel:join'](CID);

    expect(socket.join).not.toHaveBeenCalled();
  });

  it.each([['UUID ではない文字列', 'not-a-uuid'], ['数値', 123], ['null', null], ['オブジェクト', { a: 1 }]])(
    '%s のときは DB に問い合わせず、参加もしない',
    async (_label, value) => {
      const { socket, handlers } = makeSocket();

      await handlers['channel:join'](value);

      expect(query).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    }
  );

  it('DB でエラーが起きても落ちず、参加もしない', async () => {
    query.mockRejectedValue(new Error('db down'));
    const { socket, handlers } = makeSocket();

    await expect(handlers['channel:join'](CID)).resolves.toBeUndefined();

    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe('typing', () => {
  it('参加済みのチャンネルでは、入力中が他の参加者へ送られる', () => {
    const { socket, handlers, emit } = makeSocket();
    socket.rooms.add(ROOM);

    handlers['typing_start'](CID);
    handlers['typing_stop'](CID);

    expect(emit).toHaveBeenNthCalledWith(1, 'typing', { userId: 'u1', channelId: CID, typing: true });
    expect(emit).toHaveBeenNthCalledWith(2, 'typing', { userId: 'u1', channelId: CID, typing: false });
  });

  it('参加していないチャンネルへは送られない', () => {
    const { handlers, emit } = makeSocket();

    handlers['typing_start'](CID);
    handlers['typing_stop'](CID);
    handlers['typing_start'](123);

    expect(emit).not.toHaveBeenCalled();
  });
});

describe('channel:leave', () => {
  it('退出できる', () => {
    const { socket, handlers } = makeSocket();
    socket.rooms.add(ROOM);

    handlers['channel:leave'](CID);

    expect(socket.leave).toHaveBeenCalledWith(ROOM);
  });
});
