'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  workspaceId: string;
  channelId: string;
  onJoined: () => void;
}

// 未参加の公開チャンネルで、入力欄の代わりに表示する
export default function JoinChannelBar({ workspaceId, channelId, onJoined }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function join() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/workspaces/${workspaceId}/channels/${channelId}/join`, {});
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加に失敗しました');
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-800 bg-gray-900">
      <div>
        <p className="text-sm text-gray-300">このチャンネルに参加していません</p>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
      <button
        onClick={join}
        disabled={busy}
        className="px-4 py-2 text-sm rounded bg-indigo-600 text-white disabled:opacity-40"
      >
        参加する
      </button>
    </div>
  );
}
