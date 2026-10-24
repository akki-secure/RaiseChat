'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { validatePassword } from '@/lib/passwordValidation';

type Step = 'username' | 'answer' | 'done';

export default function ResetPasswordPage() {
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handlePasswordChange(value: string) {
    setNewPassword(value);
    setPasswordError(value ? validatePassword(value).error : null);
  }

  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.get<{ question: string }>(`/auth/security-question?username=${encodeURIComponent(username)}`);
      setQuestion(res.question);
      setStep('answer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ユーザーが見つかりません');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const result = validatePassword(newPassword);
    if (!result.valid) {
      setPasswordError(result.error);
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { username, answer, newPassword });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'リセットに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">パスワードリセット</h1>

        {step === 'username' && (
          <>
            <p className="text-gray-400 text-sm text-center mb-6">登録時のユーザーIDを入力してください</p>
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">ユーザーID</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
              >
                {loading ? '確認中…' : '次へ'}
              </button>
            </form>
          </>
        )}

        {step === 'answer' && (
          <>
            <p className="text-gray-400 text-sm text-center mb-6">秘密の質問に答えてください</p>
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <p className="text-sm text-white bg-gray-800 rounded-lg px-4 py-3">{question}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">回答</label>
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">新しいパスワード</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
                    className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">8文字以上・英字・数字・記号を含めてください</p>
                {passwordError && <p className="text-red-400 text-xs mt-1">{passwordError}</p>}
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !!passwordError}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
              >
                {loading ? 'リセット中…' : 'パスワードをリセット'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <p className="text-green-400">パスワードをリセットしました。</p>
            <Link
              href="/auth/login"
              className="block w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 transition-colors text-center"
            >
              ログインへ
            </Link>
          </div>
        )}

        {step !== 'done' && (
          <p className="mt-4 text-center text-sm text-gray-500">
            <Link href="/auth/login" className="text-indigo-400 hover:underline">
              ログインに戻る
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
