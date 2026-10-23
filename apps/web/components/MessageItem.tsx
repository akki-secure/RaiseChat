'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, useAppStore } from '@/stores/useAppStore';
import { api } from '@/lib/api';

interface Props {
  msg: Message;
  channelId: string;
  onReply?: (msg: Message) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏'];

export default function MessageItem({ msg, channelId, onReply }: Props) {
  const { me, addReaction, removeReaction, softDeleteMessage } = useAppStore();
  const [showActions, setShowActions] = useState(false);

  const isDeleted = !!msg.deleted_at;
  const isOwn = msg.user_id === me?.id;
  const displayName = msg.user?.display_name ?? msg.user?.username ?? '…';
  const initial = displayName.charAt(0).toUpperCase();
  const time = new Date(msg.created_at).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  async function toggleReaction(emoji: string) {
    const existing = msg.reactions?.find((r) => r.emoji === emoji);
    if (existing?.reacted) {
      removeReaction(channelId, msg.id, emoji);
      await api.delete(`/messages/${msg.id}/reactions/${encodeURIComponent(emoji)}`).catch(() => {
        addReaction(channelId, msg.id, emoji);
      });
    } else {
      addReaction(channelId, msg.id, emoji);
      await api.post(`/messages/${msg.id}/reactions`, { emoji }).catch(() => {
        removeReaction(channelId, msg.id, emoji);
      });
    }
  }

  async function handleDelete() {
    softDeleteMessage(channelId, msg.id);
    await api.delete(`/messages/${msg.id}`).catch(() => {});
  }

  return (
    <div
      className="group flex gap-3 px-4 py-1.5 hover:bg-gray-800/50 rounded"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white mt-0.5">
        {msg.user?.avatar_url ? (
          <img src={msg.user.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
        ) : (
          initial
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-white">{displayName}</span>
          <span className="text-xs text-gray-500">{time}</span>
          {msg.edited_at && !isDeleted && (
            <span className="text-xs text-gray-600">(編集済み)</span>
          )}
        </div>

        {isDeleted ? (
          <p className="text-sm text-gray-600 italic">このメッセージは削除されました</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none break-words
            [&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0
            [&_code]:bg-gray-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-indigo-300 [&_code]:text-xs
            [&_pre]:bg-gray-900 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0
            [&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:text-gray-400
            [&_a]:text-indigo-400 [&_a]:underline [&_strong]:text-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        )}

        {/* 添付ファイル */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {msg.attachments.map((a) =>
              a.file_type.startsWith('image/') ? (
                <img
                  key={a.id}
                  src={a.url}
                  alt="attachment"
                  className="max-h-48 rounded border border-gray-700"
                />
              ) : (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:underline"
                >
                  📎 ファイルを開く
                </a>
              )
            )}
          </div>
        )}

        {/* リアクション */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {msg.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => toggleReaction(r.emoji)}
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  r.reacted
                    ? 'bg-indigo-900 border-indigo-600 text-indigo-200'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ホバーアクション */}
      {showActions && !isDeleted && (
        <div className="flex items-start gap-1 flex-shrink-0">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => toggleReaction(e)}
              className="text-sm hover:scale-125 transition-transform"
            >
              {e}
            </button>
          ))}
          {onReply && (
            <button
              onClick={() => onReply(msg)}
              className="ml-1 text-xs text-gray-500 hover:text-white px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700"
            >
              返信
            </button>
          )}
          {isOwn && (
            <button
              onClick={handleDelete}
              className="text-xs text-gray-500 hover:text-red-400 px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700"
            >
              削除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
