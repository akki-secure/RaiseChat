'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, User } from '@/stores/useAppStore';

export default function RootPage() {
  const router = useRouter();
  const { me, setMe, workspaces } = useAppStore();

  useEffect(() => {
    if (me) {
      if (workspaces.length > 0) {
        router.replace(`/workspace/${workspaces[0].id}`);
      } else {
        router.replace('/workspace/new');
      }
      return;
    }

    api
      .get<{ user: User }>('/auth/me')
      .then(({ user }) => {
        setMe(user);
        router.replace('/');
      })
      .catch(() => {
        router.replace('/auth/login');
      });
  }, [me, workspaces, router, setMe]);

  return null;
}
