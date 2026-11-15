'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { canKickNow, MemberRow, RemovedMember, WarningsResponse } from './types';

interface Props {
  workspaceId: string;
  meId: string;
}

type Action = { uid: string; type: 'warn' | 'kick' } | null;

const DEFAULT_THRESHOLD = 3;
const name = (m: { display_name: string | null; username: string }) => m.display_name ?? m.username;

// メンバーへの警告・キックとキック解除（owner 向け）。キックは常に owner の手動操作
export default function MemberModerationPanel({ workspaceId, meId }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [removed, setRemoved] = useState<RemovedMember[]>([]);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [severe, setSevere] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ members: ms }, { members: rm }] = await Promise.all([
        api.get<{ members: MemberRow[] }>(`/workspaces/${workspaceId}/members`),
        api.get<{ members: RemovedMember[] }>(`/workspaces/${workspaceId}/members/removed`),
      ]);
      const targets = ms.filter((m) => m.id !== meId && m.role !== 'owner');
      setMembers(targets);
      setRemoved(rm);
      const results = await Promise.all(
        targets.map((m) =>
          api.get<WarningsResponse>(`/workspaces/${workspaceId}/members/${m.id}/warnings`).catch(() => null)
        )
      );
      const next: Record<string, number> = {};
      targets.forEach((m, i) => { next[m.id] = results[i]?.active_count ?? 0; });
      setCounts(next);
      const t = results.find((r) => r)?.threshold;
      if (t) setThreshold(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました');
    }
  }, [workspaceId, meId]);

  useEffect(() => { load(); }, [load]);

  function open(uid: string, type: 'warn' | 'kick') {
    setAction({ uid, type });
    setReason('');
    setSevere(false);
    setError('');
  }

  async function submit() {
    if (!action) return;
    setBusy(true);
    setError('');
    try {
      const base = `/workspaces/${workspaceId}/members/${action.uid}`;
      if (action.type === 'warn') await api.post(`${base}/warn`, { reason });
      else await api.post(`${base}/kick`, { reason, severe });
      setAction(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function unkick(uid: string) {
    setError('');
    try {
      await api.post(`/workspaces/${workspaceId}/members/${uid}/unkick`, {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '解除に失敗しました');
    }
  }

  const target = action ? members.find((m) => m.id === action.uid) : null;
  const kickAllowed = action?.type === 'kick' && target
    ? canKickNow(counts[target.id] ?? 0, threshold, severe)
    : true;

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        警告が{threshold}回たまるとキックできます。人格否定などの重大違反は、理由を記録すれば警告なしでもキックできます。キックは自動では行われません。
      </p>
      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      <ul className="space-y-2">
        {members.length === 0 && <li className="text-sm text-gray-500">対象のメンバーがいません</li>}
        {members.map((m) => (
          <li key={m.id} className="bg-gray-800 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-sm text-white">{name(m)}</span>
              <span className="text-xs text-gray-400" data-testid={`count-${m.id}`}>
                警告 {counts[m.id] ?? 0}/{threshold}
              </span>
              <button onClick={() => open(m.id, 'warn')} className="px-2 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-500 text-white">警告</button>
              <button onClick={() => open(m.id, 'kick')} className="px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600 text-white">キック</button>
            </div>

            {action?.uid === m.id && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs text-gray-400">
                  {action.type === 'warn' ? '警告の理由（本人に表示されます）' : 'キックの理由（記録されます）'}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full bg-gray-900 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {action.type === 'kick' && (
                  <label className="flex items-center gap-2 text-xs text-gray-300">
                    <input type="checkbox" checked={severe} onChange={(e) => setSevere(e.target.checked)} />
                    重大違反（人格否定など。警告なしでキックする）
                  </label>
                )}
                {action.type === 'kick' && !kickAllowed && (
                  <p className="text-xs text-yellow-500">警告が{threshold}回に達していません。重大違反の場合はチェックしてください。</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={submit}
                    disabled={busy || !reason.trim() || !kickAllowed}
                    className="px-3 py-1.5 text-sm rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
                  >
                    {action.type === 'warn' ? '警告する' : 'キックする'}
                  </button>
                  <button onClick={() => setAction(null)} className="px-3 py-1.5 text-sm rounded bg-gray-700 text-gray-200">
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">キック済み</h3>
        <ul className="space-y-2">
          {removed.length === 0 && <li className="text-sm text-gray-500">いません</li>}
          {removed.map((m) => (
            <li key={m.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{name(m)}</p>
                {m.removed_reason && <p className="text-xs text-gray-500 truncate">{m.removed_reason}</p>}
              </div>
              <button onClick={() => unkick(m.id)} className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white">
                キック解除
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
