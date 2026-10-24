'use client';

import { useState, FormEvent } from 'react';
import { api } from '@/lib/api';
import { User } from '@/stores/useAppStore';

interface Props {
  onSuccess: (user: User) => void;
  onBack: () => void;
}

export default function TotpVerifyStep({ onSuccess, onBack }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError('6桁のコードを入力してください'); return; }
    setLoading(true);
    setError('');
    try {
      const { user } = await api.post<{ user: User }>('/totp/verify', { code });
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'コードが正しくありません');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-2">
        <div className="text-3xl mb-2">📱</div>
        <p className="text-sm text-gray-400">
          認証アプリに表示されている<br />6桁のコードを入力してください
        </p>
      </div>

      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="000000"
        autoFocus
        className="w-full bg-gray-800 text-white text-center text-2xl tracking-[0.5em] rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
      >
        {loading ? '確認中…' : '確認'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← パスワード入力に戻る
      </button>
    </form>
  );
}
