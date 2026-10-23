'use client';

import { useAppStore } from '@/stores/useAppStore';

export default function WorkspaceIndexPage() {
  const channels = useAppStore((s) => s.channels);

  return (
    <div className="flex-1 flex items-center justify-center text-gray-500">
      {channels.length > 0
        ? 'チャンネルを選択してください'
        : 'チャンネルがありません。最初のチャンネルを作成しましょう。'}
    </div>
  );
}
