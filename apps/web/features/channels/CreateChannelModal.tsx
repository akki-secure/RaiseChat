'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { Channel } from '@/stores/useAppStore';

interface Props {
  workspaceId: string;
  onCreated: (channel: Channel) => void;
  onClose: () => void;
}

// サーバー側の制約と同じ（小文字英数字・_・-）
const NAME_RE = /^[a-z0-9_-]{1,100}$/;

// チャンネル作成。画面中央モーダルの3層構造
export default function CreateChannelModal({ workspaceId, onCreated, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!mounted) return null;

  const valid = NAME_RE.test(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const { channel } = await api.post<{ channel: Channel }>(
        `/workspaces/${workspaceId}/channels`,
        { name, type }
      );
      onCreated(channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
      setBusy(false);
    }
  }

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999 }}>
      <div
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      />
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <form
          role="dialog"
          aria-label="チャンネルを作成"
          onSubmit={submit}
          className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 p-6 flex flex-col gap-4"
          style={{ width: '420px', maxWidth: 'calc(100vw - 2rem)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold text-white">チャンネルを作成</h2>
          <label className="flex flex-col gap-1 text-sm text-gray-400">
            チャンネル名
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="random"
              className="bg-gray-800 text-white rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-500">小文字の英数字、_ 、- が使えます</span>
          </label>
          <div className="flex gap-4 text-sm text-gray-300">
            <label className="flex items-center gap-1">
              <input type="radio" checked={type === 'public'} onChange={() => setType('public')} />
              公開
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={type === 'private'} onChange={() => setType('private')} />
              非公開
            </label>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!valid || busy}
              className="px-4 py-2 text-sm rounded bg-indigo-600 text-white disabled:opacity-40"
            >
              作成する
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
