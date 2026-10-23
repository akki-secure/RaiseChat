'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, Channel, Workspace, User } from '@/stores/useAppStore';

export default function Sidebar() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const {
    me,
    workspaces,
    setWorkspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    channels,
    setChannels,
    activeChannelId,
    setActiveChannel,
    onlineUserIds,
  } = useAppStore();

  useEffect(() => {
    if (!workspaces.length) {
      api.get<{ workspaces: Workspace[] }>('/workspaces').then(({ workspaces: ws }) => {
        setWorkspaces(ws);
      });
    }
  }, [workspaces.length, setWorkspaces]);

  useEffect(() => {
    if (!params.workspaceId) return;
    if (activeWorkspaceId !== params.workspaceId) {
      setActiveWorkspace(params.workspaceId);
    }
    api
      .get<{ channels: Channel[] }>(`/workspaces/${params.workspaceId}/channels`)
      .then(({ channels: ch }) => setChannels(ch));
  }, [params.workspaceId, activeWorkspaceId, setActiveWorkspace, setChannels]);

  async function handleLogout() {
    await api.post('/auth/logout', {}).catch(() => {});
    router.replace('/auth/login');
  }

  const statusDot: Record<string, string> = {
    online: 'bg-green-500',
    away: 'bg-yellow-400',
    busy: 'bg-red-500',
    offline: 'bg-gray-500',
  };

  return (
    <aside className="flex h-full w-[var(--sidebar-width)] flex-col bg-gray-900 border-r border-gray-800">
      {/* ワークスペース選択 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <select
          value={activeWorkspaceId ?? ''}
          onChange={(e) => {
            setActiveWorkspace(e.target.value);
            router.push(`/workspace/${e.target.value}`);
          }}
          className="flex-1 bg-transparent text-white font-semibold text-sm outline-none truncate"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id} className="bg-gray-900">
              {ws.name}
            </option>
          ))}
        </select>
        <Link
          href="/workspace/new"
          className="text-gray-400 hover:text-white text-lg leading-none"
          title="ワークスペースを追加"
        >
          +
        </Link>
      </div>

      {/* チャンネル一覧 */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* 検索 */}
        <Link
          href={`/workspace/${activeWorkspaceId}/search`}
          className="flex items-center gap-2 px-4 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded mx-1 mb-1 transition-colors"
        >
          <span>🔍</span>
          <span>検索</span>
        </Link>

        <p className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-widest">
          チャンネル
        </p>
        {channels.map((ch) => (
          <Link
            key={ch.id}
            href={`/workspace/${activeWorkspaceId}/channel/${ch.id}`}
            onClick={() => setActiveChannel(ch.id)}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded mx-1 transition-colors ${
              activeChannelId === ch.id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-gray-500">#</span>
            <span className="truncate">{ch.name}</span>
          </Link>
        ))}

        {/* DM */}
        {me && (
          <>
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest">
              ダイレクトメッセージ
            </p>
            <DMList workspaceId={activeWorkspaceId ?? ''} meId={me.id} onlineUserIds={onlineUserIds} />
          </>
        )}
      </div>

      {/* 自分のプロフィール */}
      {me && (
        <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-800">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white">
              {(me.display_name ?? me.username).charAt(0).toUpperCase()}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
                onlineUserIds.has(me.id) ? statusDot.online : statusDot.offline
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {me.display_name ?? me.username}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-red-400 text-xs transition-colors"
            title="ログアウト"
          >
            ✕
          </button>
        </div>
      )}
    </aside>
  );
}

function DMList({
  workspaceId,
  meId,
  onlineUserIds,
}: {
  workspaceId: string;
  meId: string;
  onlineUserIds: Set<string>;
}) {
  const [members, setMembers] = useState<User[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    api
      .get<{ members: (User & { role: string })[] }>(`/workspaces/${workspaceId}/members`)
      .then(({ members: ms }) => setMembers(ms.filter((m: User & { role: string }) => m.id !== meId)))
      .catch(() => {});
  }, [workspaceId, meId]);

  return (
    <>
      {members.map((m) => (
        <Link
          key={m.id}
          href={`/workspace/${workspaceId}/dm/${m.id}`}
          className="flex items-center gap-2 px-4 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded mx-1 transition-colors"
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              onlineUserIds.has(m.id) ? 'bg-green-500' : 'bg-gray-600'
            }`}
          />
          <span className="truncate">{m.display_name ?? m.username}</span>
        </Link>
      ))}
    </>
  );
}
