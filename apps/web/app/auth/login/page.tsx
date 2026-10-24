'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, User } from '@/stores/useAppStore';
import TotpVerifyStep from '@/features/totp/TotpVerifyStep';

export default function LoginPage() {
  const router = useRouter();
  const setMe = useAppStore((s) => s.setMe);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // パスワード認証後にTOTPが必要な場合 true になる
  const [requireTotp, setRequireTotp] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ user?: User; requireTotp?: boolean }>('/auth/login', { username, password });
      if (res.requireTotp) {
        // 2FA有効ユーザー → 6桁コード入力ステップへ
        setRequireTotp(true);
      } else if (res.user) {
        setMe(res.user);
        router.replace('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  function handleTotpSuccess(user: User) {
    setMe(user);
    router.replace('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">RaiseChat</h1>

        {/* 2FA有効ユーザー: パスワード認証後にこちらへ切り替わる */}
        {requireTotp ? (
          <TotpVerifyStep
            onSuccess={handleTotpSuccess}
            onBack={() => { setRequireTotp(false); setPassword(''); }}
          />
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">ユーザー名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">パスワード</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
              >
                {loading ? 'ログイン中…' : 'ログイン'}
              </button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500">
              アカウントがない方は{' '}
              <Link href="/auth/register" className="text-indigo-400 hover:underline">
                新規登録
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
