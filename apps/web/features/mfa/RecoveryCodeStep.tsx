'use client';

import { useState, FormEvent } from 'react';
import { api } from '@/lib/api';
import { User } from '@/stores/useAppStore';

interface Props {
  onSuccess: (user: User) => void;
  onBack: () => void;
}

export default function RecoveryCodeStep({ onSuccess, onBack }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { user } = await api.post<{ user: User }>('/mfa/recovery/verify', { code });
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'リカバリーコードが正しくありません');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-2">
        <div className="text-3xl mb-2">🔑</div>
        <p className="text-sm text-gray-400">
          保管しているリカバリーコードを<br />1つ入力してください（使い捨てです）
        </p>
      </div>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="XXXXX-XXXXX"
        autoFocus
        className="w-full bg-gray-800 text-white text-center text-lg tracking-widest rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      <button
        type="submit"
        disabled={loading || code.trim().length < 10}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
      >
        {loading ? '確認中…' : '確認'}
      </button>
      <button type="button" onClick={onBack}
        className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors">
        ← 他の方法に戻る
      </button>
    </form>
  );
}
