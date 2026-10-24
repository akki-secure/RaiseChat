'use client';

import { useState, FormEvent } from 'react';
import { api } from '@/lib/api';
import { useAppStore, User } from '@/stores/useAppStore';
import { validatePassword } from '@/lib/passwordValidation';
import TotpSetupModal from '@/features/totp/TotpSetupModal';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

const SECURITY_QUESTIONS = [
  '子供の頃に飼っていたペットの名前は？',
  '最初に通った学校の名前は？',
  '母親の旧姓は？',
  '好きな映画のタイトルは？',
  '生まれた街の名前は？',
  '子供の頃の親友の名前は？',
];

export default function AccountSettings() {
  const me = useAppStore((s) => s.me);
  const setMe = useAppStore((s) => s.setMe);

  // ユーザーID変更
  const [newUsername, setNewUsername] = useState(me?.username ?? '');
  const [usernameMsg, setUsernameMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);

  // パスワード変更
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [newPwError, setNewPwError] = useState<string | null>(null);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // TOTP
  const [totpEnabled, setTotpEnabled] = useState(me?.totp_enabled ?? false);
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [showTotpDisable, setShowTotpDisable] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [totpMsg, setTotpMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);

  // 秘密の質問
  const [sqQuestion, setSqQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [sqAnswer, setSqAnswer] = useState('');
  const [sqMsg, setSqMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [sqLoading, setSqLoading] = useState(false);
  const [showSqForm, setShowSqForm] = useState(false);

  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault();
    setUsernameMsg(null);
    setUsernameLoading(true);
    try {
      const res = await api.patch<{ user: User }>('/auth/username', { newUsername });
      setMe(res.user);
      setUsernameMsg({ type: 'ok', text: 'ユーザーIDを変更しました' });
    } catch (err) {
      setUsernameMsg({ type: 'err', text: err instanceof Error ? err.message : '変更に失敗しました' });
    } finally {
      setUsernameLoading(false);
    }
  }

  function handleNewPwChange(value: string) {
    setNewPw(value);
    setNewPwError(value ? validatePassword(value).error : null);
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: '新しいパスワードが一致しません' });
      return;
    }
    const result = validatePassword(newPw);
    if (!result.valid) {
      setNewPwError(result.error);
      return;
    }
    setPwLoading(true);
    try {
      await api.patch('/auth/password', { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwMsg({ type: 'ok', text: 'パスワードを変更しました' });
    } catch (err) {
      setPwMsg({ type: 'err', text: err instanceof Error ? err.message : '変更に失敗しました' });
    } finally {
      setPwLoading(false);
    }
  }

  async function handleDisableTotp(e: FormEvent) {
    e.preventDefault();
    setTotpMsg(null);
    setTotpLoading(true);
    try {
      await api.delete('/totp/disable', { code: disableCode });
      setTotpEnabled(false);
      setMe({ ...me!, totp_enabled: false });
      setShowTotpDisable(false);
      setDisableCode('');
      setTotpMsg({ type: 'ok', text: '2段階認証を無効にしました' });
    } catch (err) {
      setTotpMsg({ type: 'err', text: err instanceof Error ? err.message : '無効化に失敗しました' });
    } finally {
      setTotpLoading(false);
    }
  }

  async function handleSqSubmit(e: FormEvent) {
    e.preventDefault();
    setSqMsg(null);
    setSqLoading(true);
    try {
      await api.post('/auth/security-question', { question: sqQuestion, answer: sqAnswer });
      setMe({ ...me!, has_security_question: true });
      setSqAnswer('');
      setShowSqForm(false);
      setSqMsg({ type: 'ok', text: '秘密の質問を設定しました' });
    } catch (err) {
      setSqMsg({ type: 'err', text: err instanceof Error ? err.message : '設定に失敗しました' });
    } finally {
      setSqLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── ユーザーID変更 ── */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">ユーザーID</h3>
        <form onSubmit={handleUsernameSubmit} className="space-y-3">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            required
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          {usernameMsg && (
            <p className={`text-xs ${usernameMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {usernameMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={usernameLoading || newUsername === me?.username}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            {usernameLoading ? '変更中…' : 'ユーザーIDを変更'}
          </button>
        </form>
      </section>

      <div className="border-t border-gray-700" />

      {/* ── パスワード変更 ── */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">パスワード変更</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">現在のパスワード</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 pr-9 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button type="button" onClick={() => setShowCurrentPw((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label={showCurrentPw ? 'パスワードを非表示' : 'パスワードを表示'}>
                <EyeIcon open={showCurrentPw} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">新しいパスワード</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => handleNewPwChange(e.target.value)}
                required
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 pr-9 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button type="button" onClick={() => setShowNewPw((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label={showNewPw ? 'パスワードを非表示' : 'パスワードを表示'}>
                <EyeIcon open={showNewPw} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">8文字以上・英字・数字・記号を含めてください</p>
            {newPwError && <p className="text-red-400 text-xs mt-1">{newPwError}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">新しいパスワード（確認）</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          {pwMsg && (
            <p className={`text-xs ${pwMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {pwMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={pwLoading || !!newPwError || !currentPw || !newPw || !confirmPw}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            {pwLoading ? '変更中…' : 'パスワードを変更'}
          </button>
        </form>
      </section>

      <div className="border-t border-gray-700" />

      {/* ── ワンタイムパスワード（TOTP）── */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">ワンタイムパスワード（2段階認証）</h3>
            <p className="text-xs text-yellow-400 mt-0.5">※ セキュリティ向上のため推奨</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setTotpMsg(null);
              if (totpEnabled) {
                setShowTotpDisable(true);
              } else {
                setShowTotpSetup(true);
              }
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${totpEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
            aria-label={totpEnabled ? '2段階認証を無効にする' : '2段階認証を有効にする'}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${totpEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {totpEnabled ? '有効：ログイン時に認証アプリのコードが必要です' : '無効：パスワードのみでログインできます'}
        </p>
        {totpMsg && (
          <p className={`text-xs mt-2 ${totpMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            {totpMsg.text}
          </p>
        )}

        {showTotpDisable && (
          <form onSubmit={handleDisableTotp} className="mt-3 space-y-2 bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-300">認証アプリのコードを入力して無効化してください</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="w-full bg-gray-700 text-white text-center tracking-widest rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowTotpDisable(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg py-2 transition-colors">
                キャンセル
              </button>
              <button type="submit" disabled={totpLoading || disableCode.length !== 6}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg py-2 transition-colors">
                {totpLoading ? '無効化中…' : '無効にする'}
              </button>
            </div>
          </form>
        )}
      </section>

      <div className="border-t border-gray-700" />

      {/* ── 秘密の質問 ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">秘密の質問</h3>
            <p className="text-xs text-gray-500 mt-0.5">パスワードを忘れたときの本人確認に使用します</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowSqForm((v) => !v); setSqMsg(null); }}
            className="text-xs text-indigo-400 hover:underline"
          >
            {me?.has_security_question ? '変更する' : '設定する'}
          </button>
        </div>
        {!showSqForm && (
          <p className="text-xs text-gray-500">
            {me?.has_security_question ? '設定済み' : '未設定 — パスワードリセットに必要です'}
          </p>
        )}
        {sqMsg && (
          <p className={`text-xs mt-1 ${sqMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            {sqMsg.text}
          </p>
        )}
        {showSqForm && (
          <form onSubmit={handleSqSubmit} className="mt-3 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">質問を選択</label>
              <select
                value={sqQuestion}
                onChange={(e) => setSqQuestion(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">回答</label>
              <input
                type="text"
                value={sqAnswer}
                onChange={(e) => setSqAnswer(e.target.value)}
                required
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowSqForm(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg py-2 transition-colors">
                キャンセル
              </button>
              <button type="submit" disabled={sqLoading || !sqAnswer}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors">
                {sqLoading ? '保存中…' : '保存する'}
              </button>
            </div>
          </form>
        )}
      </section>

      {showTotpSetup && (
        <TotpSetupModal
          onClose={() => setShowTotpSetup(false)}
          onEnabled={() => {
            setTotpEnabled(true);
            setMe({ ...me!, totp_enabled: true });
            setShowTotpSetup(false);
            setTotpMsg({ type: 'ok', text: '2段階認証を有効にしました' });
          }}
        />
      )}
    </div>
  );
}
