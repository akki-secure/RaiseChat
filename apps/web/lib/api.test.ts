import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('api', () => {
  it('GET リクエストを送信してレスポンスを返す', async () => {
    mockFetch.mockResolvedValue(makeResponse({ id: 1 }));
    const result = await api.get<{ id: number }>('/test');
    expect(result).toEqual({ id: 1 });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('POST リクエストにボディを JSON で送信する', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }));
    await api.post('/test', { name: 'alice' });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ name: 'alice' }));
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('PUT リクエストを送信する', async () => {
    mockFetch.mockResolvedValue(makeResponse({ updated: true }));
    await api.put('/test/1', { name: 'bob' });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('PUT');
  });

  it('PATCH リクエストを送信する', async () => {
    mockFetch.mockResolvedValue(makeResponse({ patched: true }));
    await api.patch('/test/1', { name: 'carol' });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('PATCH');
  });

  it('DELETE リクエストを送信する（ボディなし）', async () => {
    mockFetch.mockResolvedValue(makeResponse({ deleted: true }));
    await api.delete('/test/1');
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('DELETE');
    expect(options.body).toBeUndefined();
  });

  it('DELETE リクエストを送信する（ボディあり）', async () => {
    mockFetch.mockResolvedValue(makeResponse({ deleted: true }));
    await api.delete('/test/1', { reason: 'spam' });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBe(JSON.stringify({ reason: 'spam' }));
  });

  it('レスポンスが ok:false のとき Error をスローする', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'Not found' }, false, 404));
    await expect(api.get('/missing')).rejects.toThrow('Not found');
  });

  it('エラーボディに details がある場合、フィールド名を含めてスローする', async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        { details: [{ field: 'email', message: '既に使われています' }] },
        false,
        422
      )
    );
    await expect(api.post('/register', {})).rejects.toThrow('email: 既に使われています');
  });
});
