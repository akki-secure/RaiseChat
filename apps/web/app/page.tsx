'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, User, Workspace } from '@/stores/useAppStore';

export default function RootPage() {
  const router = useRouter();
  const { me, setMe, setWorkspaces } = useAppStore();

  useEffect(() => {
    if (me) return;

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
  }, [me, router, setMe, setWorkspaces]);

  return null;
}
