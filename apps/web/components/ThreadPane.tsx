'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useAppStore, Message } from '@/stores/useAppStore';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';

interface Props {
  channelId: string;
  parentId: string;
}

export default function ThreadPane({ channelId, parentId }: Props) {
  const { setThreadParent, messages } = useAppStore();
  const [replies, setReplies] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const parent = messages[channelId]?.find((m) => m.id === parentId);

  useEffect(() => {
    api
      .get<{ messages: Message[] }>(`/channels/${channelId}/messages?parent_id=${parentId}`)
      .then(({ messages: r }) => {
        setReplies(r);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      })
      .catch(() => {});
  }, [channelId, parentId]);

  async function sendReply(content: string) {
    const { message } = await api.post<{ message: Message }>(
      `/channels/${channelId}/messages`,
      { content, parent_id: parentId }
    );
    setReplies((prev) => [...prev, message]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  return (
    <div className="flex flex-col w-[var(--thread-width)] border-l border-gray-800 flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="font-semibold text-sm text-white">スレッド</h3>
        <button
          onClick={() => setThreadParent(null)}
          className="text-gray-500 hover:text-white text-lg"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* 親メッセージ */}
        {parent && (
          <div className="pb-2 mb-2 border-b border-gray-800">
            <MessageItem msg={parent} channelId={channelId} />
          </div>
        )}
        {replies.map((r) => (
          <MessageItem key={r.id} msg={r} channelId={channelId} />
        ))}
        <div ref={bottomRef} />
      </div>

      <MessageInput placeholder="返信を入力…" onSend={sendReply} />
    </div>
  );
}
