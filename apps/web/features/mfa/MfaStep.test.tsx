import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { User } from '@/stores/useAppStore';

const post = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...a: unknown[]) => post(...a) } }));
const startAuthentication = vi.fn();
vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: (...a: unknown[]) => startAuthentication(...a) }));

import MfaStep from './MfaStep';

const user = { id: 'u1', username: 'taro', display_name: 'Taro', avatar_url: null, status: 'online' } as unknown as User;

// パスごとの返り値を設定する
function mockApi(table: Record<string, unknown>) {
  post.mockImplementation(async (path: string) => {
    const v = table[path];
    if (v instanceof Error) throw v;
    return v;
  });
}
function enterTotp() {
  fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: '確認' }));
}

beforeEach(() => { post.mockReset(); startAuthentication.mockReset(); });

describe('MfaStep: どちらか一方', () => {
  it('手段が複数なら切り替えが出て、パスキーに切り替えられる', () => {
    render(<MfaStep methods={['totp', 'passkey']} mode="any" onSuccess={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByPlaceholderText('000000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'パスキー' }));
    expect(screen.getByRole('button', { name: 'パスキーで認証' })).toBeTruthy();
  });
  it('手段が1つなら切り替えは出ない', () => {
    render(<MfaStep methods={['totp']} mode="any" onSuccess={vi.fn()} onBack={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'パスキー' })).toBeNull();
  });
  it('TOTP が通れば onSuccess が呼ばれる', async () => {
    const onSuccess = vi.fn();
    mockApi({ '/totp/verify': { user } });
    render(<MfaStep methods={['totp']} mode="any" onSuccess={onSuccess} onBack={vi.fn()} />);
    enterTotp();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(user));
  });
  it('サーバーのエラー（ロック等）をそのまま表示する', async () => {
    mockApi({ '/totp/verify': new Error('認証に5回失敗したため一時的にロックされています') });
    render(<MfaStep methods={['totp']} mode="any" onSuccess={vi.fn()} onBack={vi.fn()} />);
    enterTotp();
    expect(await screen.findByText(/ロックされています/)).toBeTruthy();
  });
});

describe('MfaStep: 両方必須', () => {
  it('TOTP のあとパスキーに進み、両方通ってから onSuccess が呼ばれる', async () => {
    const onSuccess = vi.fn();
    startAuthentication.mockResolvedValue({ id: 'cred' });
    mockApi({
      '/totp/verify': { remaining: ['passkey'] },
      '/passkey/authenticate/options': { challenge: 'c' },
      '/passkey/authenticate/verify': { user },
    });
    render(<MfaStep methods={['totp', 'passkey']} mode="both" onSuccess={onSuccess} onBack={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'パスキー' })).toBeNull(); // 切り替えは出さない
    enterTotp();
    fireEvent.click(await screen.findByRole('button', { name: 'パスキーで認証' }));
    expect(onSuccess).not.toHaveBeenCalled(); // まだ完了していない
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(user));
  });
});

describe('MfaStep: パスキーとリカバリーコード', () => {
  it('パスキーをキャンセルしたら案内を表示する', async () => {
    startAuthentication.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    mockApi({ '/passkey/authenticate/options': { challenge: 'c' } });
    render(<MfaStep methods={['passkey']} mode="any" onSuccess={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'パスキーで認証' }));
    expect(await screen.findByText(/キャンセルされました/)).toBeTruthy();
  });
  it('リカバリーコードでログインできる', async () => {
    const onSuccess = vi.fn();
    mockApi({ '/mfa/recovery/verify': { user } });
    render(<MfaStep methods={['totp']} mode="any" onSuccess={onSuccess} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /リカバリーコードを使う/ }));
    fireEvent.change(screen.getByPlaceholderText('XXXXX-XXXXX'), { target: { value: 'abcde-fghij' } });
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(user));
    expect(post).toHaveBeenCalledWith('/mfa/recovery/verify', { code: 'ABCDE-FGHIJ' }); // 大文字に変換して送る
  });
});
