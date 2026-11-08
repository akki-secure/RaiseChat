'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/lib/api';

interface Status {
  mfa_mode: 'any' | 'both';
  totp_enabled: boolean;
  passkey_count: number;
  recovery_codes_remaining: number;
}
type Msg = { type: 'ok' | 'err'; text: string } | null;

interface Props {
  version: number; // TOTP・パスキーが変わったら親が増やし、状態を再取得する
}

export default function MfaSettings({ version }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  // リカバリーコード
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recoveryPw, setRecoveryPw] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  // 認証モード
  const [targetMode, setTargetMode] = useState<'any' | 'both' | null>(null);
  const [modePw, setModePw] = useState('');

  async function load() {
    setStatus(await api.get<Status>('/mfa/status'));
  }

  useEffect(() => {
    load().catch((err) => setMsg({ type: 'err', text: err instanceof Error ? err.message : '読み込みに失敗しました' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  async function handleRegenerate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post<{ codes: string[] }>('/mfa/recovery/regenerate', { password: recoveryPw });
      setCodes(res.codes);
      setSaved(false);
      setShowRecoveryForm(false);
      setRecoveryPw('');
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : '発行に失敗しました' });
    } finally {
      setBusy(false);
    }
  }

  function downloadCodes() {
    const blob = new Blob([`RaiseChat リカバリーコード\n\n${codes!.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raisechat-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleModeChange(e: FormEvent) {
    e.preventDefault();
    if (!targetMode) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.patch('/mfa/mode', { mode: targetMode, password: modePw });
      setTargetMode(null);
      setModePw('');
      await load();
      setMsg({ type: 'ok', text: targetMode === 'both' ? '「両方必須」に切り替えました' : '「どちらか一方」に切り替えました' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : '切り替えに失敗しました' });
    } finally {
      setBusy(false);
    }
  }

  if (!status) return msg ? <p className="text-xs text-red-400">{msg.text}</p> : null;

  const hasFactor = status.totp_enabled || status.passkey_count > 0;
  const bothReady = status.totp_enabled && status.passkey_count > 0 && status.recovery_codes_remaining > 0;
  const check = (ok: boolean) => (ok ? '✓' : '✗');

  return (
    <section className="space-y-6">
      {msg && <p className={`text-xs ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}

      {/* ── リカバリーコード ── */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
          <div>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">リカバリーコード</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              認証アプリやパスキーが使えないときの予備です（残り {status.recovery_codes_remaining} 個）
            </p>
          </div>
          <button type="button" disabled={!hasFactor}
            onClick={() => { setShowRecoveryForm((v) => !v); setMsg(null); }}
            className="text-xs text-indigo-400 hover:underline disabled:opacity-40 whitespace-nowrap">
            {status.recovery_codes_remaining > 0 ? '再発行する' : '発行する'}
          </button>
        </div>
        {!hasFactor && <p className="text-xs text-gray-500 mt-1">先に認証アプリまたはパスキーを設定してください</p>}

        {showRecoveryForm && (
          <form onSubmit={handleRegenerate} className="mt-3 space-y-2 bg-gray-800 rounded-lg p-3">
            {status.recovery_codes_remaining > 0 && (
              <p className="text-xs text-yellow-400">再発行すると、これまでのコードはすべて無効になります</p>
            )}
            <input type="password" value={recoveryPw} onChange={(e) => setRecoveryPw(e.target.value)}
              placeholder="パスワードを入力" autoFocus
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            <button type="submit" disabled={busy || !recoveryPw}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors">
              {busy ? '発行中…' : '発行する'}
            </button>
          </form>
        )}

        {codes && (
          <div className="mt-3 bg-gray-800 border border-yellow-600 rounded-lg p-3 space-y-3">
            <p className="text-xs text-yellow-400">この画面を閉じると二度と表示されません。安全な場所に保管してください。</p>
            <div className="grid grid-cols-2 gap-2">
              {codes.map((c) => (
                <code key={c} className="bg-gray-900 text-white text-center text-sm tracking-wider rounded px-2 py-1.5">{c}</code>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigator.clipboard.writeText(codes.join('\n'))}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg py-2 transition-colors">コピー</button>
              <button type="button" onClick={downloadCodes}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg py-2 transition-colors">ダウンロード</button>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              安全な場所に保管しました
            </label>
            <button type="button" disabled={!saved} onClick={() => setCodes(null)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors">
              閉じる
            </button>
          </div>
        )}
      </div>

      {/* ── 認証モード ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">ログイン時の認証方法</h3>
        <div className="flex gap-2 mt-2">
          {(['any', 'both'] as const).map((m) => (
            <button key={m} type="button" disabled={!hasFactor}
              onClick={() => { setTargetMode(m === status.mfa_mode ? null : m); setModePw(''); setMsg(null); }}
              className={`flex-1 text-sm rounded-lg py-2 transition-colors disabled:opacity-40 ${
                (targetMode ?? status.mfa_mode) === m ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}>
              {m === 'any' ? 'どちらか一方' : '両方必須'}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {status.mfa_mode === 'both'
            ? '現在：認証アプリとパスキーの両方が必要です（認証アプリの無効化・パスキーの削除はできません）'
            : '現在：認証アプリかパスキーのどちらか一方で認証できます'}
        </p>

        {targetMode === 'both' && (
          <div className="mt-2 text-xs text-gray-400 space-y-0.5">
            <p>「両方必須」にするには次が必要です：</p>
            <p>{check(status.totp_enabled)} 認証アプリ（TOTP）の有効化</p>
            <p>{check(status.passkey_count > 0)} パスキーの登録</p>
            <p>{check(status.recovery_codes_remaining > 0)} リカバリーコードの発行</p>
          </div>
        )}

        {targetMode && (
          <form onSubmit={handleModeChange} className="mt-3 space-y-2 bg-gray-800 rounded-lg p-3">
            <input type="password" value={modePw} onChange={(e) => setModePw(e.target.value)}
              placeholder="パスワードを入力" autoFocus
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            <button type="submit" disabled={busy || !modePw || (targetMode === 'both' && !bothReady)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors">
              {busy ? '切り替え中…' : `「${targetMode === 'both' ? '両方必須' : 'どちらか一方'}」に切り替える`}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
