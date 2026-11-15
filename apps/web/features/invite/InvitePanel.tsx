'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';

interface Props {
  workspaceId: string;
}

// 招待コードと招待リンクの表示・コピー・再生成（owner 向け）
export default function InvitePanel({ workspaceId }: Props) {
  const { workspaces, setWorkspaces } = useAppStore();
  const ws = workspaces.find((w) => w.id === workspaceId);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!ws) return null;
  const link = `${window.location.origin}/invite/${ws.invite_code}`;

  async function copy(kind: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(kind === 'code' ? ws!.invite_code : link);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError('コピーに失敗しました。手動で選択してコピーしてください');
    }
  }

  async function regenerate() {
    if (!window.confirm('招待コードを再生成します。古いコードとリンクは使えなくなります。よろしいですか？')) return;
    setBusy(true);
    setError('');
    try {
      const { invite_code } = await api.post<{ invite_code: string }>(`/workspaces/${workspaceId}/invite`, {});
      setWorkspaces(workspaces.map((w) => (w.id === workspaceId ? { ...w, invite_code } : w)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '再生成に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm text-gray-400 mb-1">招待リンク</label>
        <div className="flex gap-2">
          <input readOnly value={link} className="flex-1 min-w-0 bg-gray-800 text-white text-sm rounded-lg px-3 py-2" />
          <button onClick={() => copy('link')} className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">
            {copied === 'link' ? 'コピー済み' : 'コピー'}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">招待コード</label>
        <div className="flex gap-2">
          <input readOnly value={ws.invite_code} className="flex-1 min-w-0 bg-gray-800 text-white text-sm rounded-lg px-3 py-2" />
          <button onClick={() => copy('code')} className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">
            {copied === 'code' ? 'コピー済み' : 'コピー'}
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="border-t border-gray-800 pt-4">
        <button
          onClick={regenerate}
          disabled={busy}
          className="px-3 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-red-400 disabled:opacity-50"
        >
          コードを再生成
        </button>
        <p className="mt-2 text-xs text-gray-500">リンクが漏れたときに使います。再生成すると、古いコードとリンクは無効になります。</p>
      </div>
    </div>
  );
}
