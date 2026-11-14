import { describe, it, expect, vi, beforeEach } from 'vitest';

type FakeSocket = { connected: boolean; active: boolean; disconnect: ReturnType<typeof vi.fn> };
const created: FakeSocket[] = [];
const ioMock = vi.fn((): FakeSocket => {
  const s: FakeSocket = { connected: false, active: true, disconnect: vi.fn() };
  created.push(s);
  return s;
});
vi.mock('socket.io-client', () => ({ io: () => ioMock() }));

// socket.ts はモジュール内に接続を持つので、テストごとに読み直す
async function load() {
  vi.resetModules();
  return import('./socket');
}

beforeEach(() => {
  created.length = 0;
  ioMock.mockClear();
});

describe('getSocket', () => {
  it('接続中に何度呼んでも、同じ接続が返り、新しく作られない', async () => {
    const { getSocket } = await load();

    const a = getSocket('');
    const b = getSocket('');
    const c = getSocket('');

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('接続済みなら、同じ接続が返る', async () => {
    const { getSocket } = await load();
    const a = getSocket('') as unknown as FakeSocket;
    a.connected = true;

    expect(getSocket('')).toBe(a);
    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('拒否された・閉じられた接続（active が false）は使い回さず、作り直す', async () => {
    const { getSocket } = await load();
    const a = getSocket('') as unknown as FakeSocket;
    a.active = false;

    const b = getSocket('');

    expect(b).not.toBe(a);
    expect(ioMock).toHaveBeenCalledTimes(2);
  });
});

describe('disconnectSocket', () => {
  it('古い接続を閉じ、次の getSocket は新しい接続を作る', async () => {
    const { getSocket, disconnectSocket } = await load();
    const a = getSocket('') as unknown as FakeSocket;
    a.connected = true;

    disconnectSocket();
    const b = getSocket('');

    expect(a.disconnect).toHaveBeenCalledTimes(1);
    expect(b).not.toBe(a);
    expect(ioMock).toHaveBeenCalledTimes(2);
  });

  it('接続がないときに呼んでもエラーにならない', async () => {
    const { disconnectSocket } = await load();

    expect(() => disconnectSocket()).not.toThrow();
  });
});
