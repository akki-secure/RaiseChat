'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, User, Workspace } from '@/stores/useAppStore';

export default function RootPage() {
  const router = useRouter();
  const { setMe, setWorkspaces } = useAppStore();

  useEffect(() => {
    // ログイン直後は me がセット済みだが、遷移先の決定にはワークスペース一覧が必要なので
    // me の有無に関わらず必ず取得してリダイレクトする
    api
      .get<{ user: User }>('/auth/me')
      .then(async ({ user }) => {
        setMe(user);
        const { workspaces } = await api.get<{ workspaces: Workspace[] }>('/workspaces');
        setWorkspaces(workspaces);
        if (workspaces.length > 0) {
          router.replace(`/workspace/${workspaces[0].id}`);
        } else {
          router.replace('/workspace/new');
        }
      })
      .catch(() => {
        router.replace('/auth/login');
      });
  }, [router, setMe, setWorkspaces]);

  return null;
}
