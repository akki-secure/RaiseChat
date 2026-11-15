'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, User, Workspace } from '@/stores/useAppStore';
import { withNext } from '@/lib/safeNext';

// 招待リンク /invite/<コード>。未ログインならログイン後にここへ戻ってくる
export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { setMe, setWorkspaces, setActiveWorkspace } = useAppStore();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const { user } = await api.get<{ user: User }>('/auth/me').catch(() => ({ user: null }));
        if (!user) {
          router.replace(withNext('/auth/login', `/invite/${code}`));
          return;
        }
        setMe(user);

        const { workspace } = await api.post<{ workspace: Workspace }>('/workspaces/join', { invite_code: code });
        const { workspaces } = await api.get<{ workspaces: Workspace[] }>('/workspaces');
        setWorkspaces(workspaces);
        setActiveWorkspace(workspace.id);
        router.replace(`/workspace/${workspace.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : '参加に失敗しました');
      }
    })();
  }, [code, router, setMe, setWorkspaces, setActiveWorkspace]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl p-8 shadow-xl text-center">
        <h1 className="text-xl font-bold text-white mb-4">ワークスペースへの招待</h1>
        {error ? (
          <>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <Link href="/" className="text-indigo-400 hover:underline text-sm">
              トップへ戻る
            </Link>
          </>
        ) : (
          <p className="text-gray-400 text-sm">参加しています…</p>
        )}
      </div>
    </div>
  );
}
