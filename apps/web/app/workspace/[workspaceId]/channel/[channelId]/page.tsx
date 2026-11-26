'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { useAppStore, Message, Channel } from '@/stores/useAppStore';
import { useMessages } from '@/hooks/useMessages';
import MessageItem from '@/components/MessageItem';
import MessageInput from '@/components/MessageInput';
import ThreadPane from '@/components/ThreadPane';
import { api } from '@/lib/api';
import { UploadedAttachment } from '@/features/fileUpload/types';
import JoinChannelBar from '@/features/channels/JoinChannelBar';

export default function ChannelPage() {
  const { workspaceId, channelId } = useParams<{ workspaceId: string; channelId: string }>();
  const { me, channels, setChannels, setActiveChannel, setThreadParent, threadParentId, appendMessage, updateMessage, softDeleteMessage } =
    useAppStore();

  const channel = channels.find((c) => c.id === channelId);
  const { msgs, loadMore, hasMore } = useMessages(channelId);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    setActiveChannel(channelId);
  }, [channelId, setActiveChannel]);

  // 初回読み込み後に最下部へスクロール
  useEffect(() => {
    if (msgs.length > 0 && isFirstLoad.current) {
      bottomRef.current?.scrollIntoView();
      isFirstLoad.current = false;
    }
  }, [msgs.length]);

  // 無限スクロール（上端到達で過去メッセージ取得）
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore) return;
    if (el.scrollTop < 100) loadMore();
  }, [hasMore, loadMore]);

  // Socket.io イベント購読
  useEffect(() => {
    const socket = getSocket('');

    const joinChannel = () => socket.emit('channel:join', channelId);
    joinChannel();

    const onNew = (msg: Message) => {
      // 返信（parent_id がある投稿）は、チャンネルの一覧に出さない
      if (msg.channel_id !== channelId || msg.parent_id) return;
      appendMessage(channelId, msg);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };
    const onUpdate = (msg: Message) => {
      if (msg.channel_id === channelId) updateMessage(channelId, msg);
    };
    const onDelete = ({ id }: { id: string }) => softDeleteMessage(channelId, id);

    // 再接続時にチャンネルルームへ再参加
    socket.on('connect', joinChannel);
    socket.on('message:new', onNew);
    socket.on('message:update', onUpdate);
    socket.on('message:delete', onDelete);

    return () => {
      socket.emit('channel:leave', channelId);
      socket.off('connect', joinChannel);
      socket.off('message:new', onNew);
      socket.off('message:update', onUpdate);
      socket.off('message:delete', onDelete);
    };
  }, [channelId, appendMessage, updateMessage, softDeleteMessage]);

  async function sendMessage(content: string, attachments?: UploadedAttachment[]) {
    if (!me) return;
    await api.post(`/channels/${channelId}/messages`, { content, attachments });
  }

  // 参加後は一覧を取り直し、チャンネルのルームにも入る
  async function handleJoined() {
    const { channels: ch } = await api.get<{ channels: Channel[] }>(`/workspaces/${workspaceId}/channels`);
    setChannels(ch);
    getSocket('').emit('channel:join', channelId);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <span className="text-gray-500">#</span>
          <h2 className="font-semibold text-white">{channel?.name ?? '…'}</h2>
        </div>

        {/* メッセージリスト */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto py-2"
        >
          {hasMore && (
            <div className="text-center py-2">
              <button
                onClick={loadMore}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                過去のメッセージを読み込む
              </button>
            </div>
          )}
          {msgs.map((msg) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              channelId={channelId}
              onReply={msg.parent_id === null ? () => setThreadParent(msg.id) : undefined}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 入力欄 */}
        {channel && !channel.joined_at ? (
          <JoinChannelBar workspaceId={workspaceId} channelId={channelId} onJoined={handleJoined} />
        ) : (
          <MessageInput
            placeholder={`#${channel?.name ?? '…'} へメッセージ`}
            onSend={sendMessage}
            allowAttachments
          />
        )}
      </div>

      {/* スレッドパネル */}
      {threadParentId && (
        <ThreadPane channelId={channelId} parentId={threadParentId} />
      )}
    </div>
  );
}
