'use client';

import { useEffect, useState, FormEvent } from 'react';
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { api } from '@/lib/api';

interface PasskeyItem { id: string; device_name: string; created_at: string; last_used_at: string | null }
type Msg = { type: 'ok' | 'err'; text: string } | null;

interface Props {
  onChanged: (count: number) => void; // 件数が変わったら親に通知
}

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('ja-JP') : '未使用');

export default function PasskeySettings({ onChanged }: Props) {
  const [items, setItems] = useState<PasskeyItem[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [adding, setAdding] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePw, setDeletePw] = useState('');

  async function load() {
    const { passkeys } = await api.get<{ passkeys: PasskeyItem[] }>('/passkey');
    setItems(passkeys);
    onChanged(passkeys.length);
  }

  useEffect(() => {
    load().catch((err) => setMsg({ type: 'err', text: err instanceof Error ? err.message : '読み込みに失敗しました' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const optionsJSON = await api.post<PublicKeyCredentialCreationOptionsJSON>('/passkey/register/options', {});
      const response = await startRegistration({ optionsJSON });
      await api.post('/passkey/register/verify', { response, deviceName: deviceName.trim() || 'パスキー' });
      setAdding(false);
      setDeviceName('');
      await load();
      setMsg({ type: 'ok', text: 'パスキーを登録しました。紛失に備えて、複数の端末に登録しておくと安心です' });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const text =
        name === 'NotAllowedError' ? '登録がキャンセルされました'
        : name === 'InvalidStateError' ? 'この端末のパスキーは既に登録されています'
        : err instanceof Error ? err.message : '登録に失敗しました';
      setMsg({ type: 'err', text });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    if (!deleteId) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.delete(`/passkey/${deleteId}`, { password: deletePw });
      setDeleteId(null);
      setDeletePw('');
      await load();
      setMsg({ type: 'ok', text: 'パスキーを削除しました' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : '削除に失敗しました' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }} className="mb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">パスキー（指紋認証）</h3>
          <p className="text-xs text-gray-500 mt-0.5">Touch ID などの生体認証で2段階認証を行います</p>
        </div>
        <button type="button" onClick={() => { setAdding((v) => !v); setMsg(null); }}
          className="text-xs text-indigo-400 hover:underline whitespace-nowrap">
          {adding ? '閉じる' : '追加する'}
        </button>
      </div>

      {msg && (
        <p className={`text-xs mb-2 ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="mb-3 space-y-2 bg-gray-800 rounded-lg p-3">
          <label className="block text-xs text-gray-400">名前（任意・例: 自分のMac）</label>
          <input type="text" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} maxLength={100}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          <button type="submit" disabled={busy}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors">
            {busy ? '登録中…（指紋認証を行ってください）' : 'パスキーを登録'}
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-500">未登録</p>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{p.device_name}</p>
                  <p className="text-xs text-gray-500">登録 {fmt(p.created_at)} ／ 最終使用 {fmt(p.last_used_at)}</p>
                </div>
                <button type="button" onClick={() => { setDeleteId(deleteId === p.id ? null : p.id); setDeletePw(''); setMsg(null); }}
                  className="text-xs text-red-400 hover:underline whitespace-nowrap">削除</button>
              </div>
              {deleteId === p.id && (
                <form onSubmit={handleDelete} className="mt-2 space-y-2">
                  <input type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)}
                    placeholder="パスワードを入力" autoFocus
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                  <button type="submit" disabled={busy || !deletePw}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg py-2 transition-colors">
                    {busy ? '削除中…' : '削除する'}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
