'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, Channel, Workspace, User } from '@/stores/useAppStore';
import SettingsModal from '@/features/settings/SettingsModal';

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
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
        <div className="border-t border-gray-800 px-4 py-3">
          <div className="relative flex items-center gap-1">
            <button
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex items-center gap-3 flex-1 min-w-0 rounded-md px-1 py-1 hover:bg-gray-800 transition-colors"
            >
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
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white truncate">
                  {me.display_name ?? me.username}
                </p>
              </div>
              <span className="text-gray-500 text-xs">{showUserMenu ? '▲' : '▼'}</span>
            </button>
            {/* 歯車アイコン（設定を開く） */}
            <button
              onClick={() => { setShowUserMenu(false); setShowSettings(true); }}
              className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-gray-800 flex-shrink-0"
              aria-label="設定"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {showUserMenu && (
              <div className="absolute bottom-full left-0 w-full mb-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg overflow-hidden z-10">
                <button
                  onClick={() => { setShowUserMenu(false); handleLogout(); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                >
                  <span>↩</span>
                  <span>ログアウト</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
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
