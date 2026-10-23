'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore, DM, User } from '@/stores/useAppStore';
import MessageInput from '@/components/MessageInput';

export default function DMPage() {
  const { workspaceId, userId } = useParams<{ workspaceId: string; userId: string }>();
  const { me, onlineUserIds } = useAppStore();
  const [partner, setPartner] = useState<User | null>(null);
  const [dms, setDms] = useState<DM[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ user: User }>(`/workspaces/${workspaceId}/members/${userId}`)
      .then(({ user }) => setPartner(user))
      .catch(() => {});

    api.get<{ messages: DM[] }>(`/workspaces/${workspaceId}/dms/${userId}`)
      .then(({ messages }) => {
        setDms(messages);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      })
      .catch(() => {});
  }, [workspaceId, userId]);

  async function sendDM(content: string) {
    if (!me) return;
    const { message } = await api.post<{ message: DM }>(
      `/workspaces/${workspaceId}/dms/${userId}`,
      { content }
    );
    setDms((prev) => [...prev, message]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  const displayName = partner?.display_name ?? partner?.username ?? '…';
  const isOnline = partner ? onlineUserIds.has(partner.id) : false;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
              isOnline ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
        </div>
        <h2 className="font-semibold text-white">{displayName}</h2>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-4">
        {dms.map((dm) => {
          const isOwn = dm.sender_id === me?.id;
          const time = new Date(dm.created_at).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <div key={dm.id} className={`flex gap-3 py-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white">
                {isOwn
                  ? (me.display_name ?? me.username).charAt(0).toUpperCase()
                  : displayName.charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`px-3 py-2 rounded-xl text-sm ${
                    isOwn
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-gray-800 text-gray-100 rounded-tl-none'
                  }`}
                >
                  {dm.content}
                </div>
                <span className="text-xs text-gray-600 mt-0.5">{time}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        placeholder={`${displayName} へメッセージ`}
        onSend={sendDM}
      />
    </div>
  );
}
