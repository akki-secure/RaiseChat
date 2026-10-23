import { useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAppStore, Message } from '@/stores/useAppStore';

const PAGE_SIZE = 50;

export function useMessages(channelId: string | null) {
  const {
    messages,
    setMessages,
    prependMessages,
    appendMessage,
    updateMessage,
    softDeleteMessage,
  } = useAppStore();

  const msgs = channelId ? (messages[channelId] ?? []) : [];
  const oldestCursor = useRef<string | null>(null);
  const hasMore = useRef(true);

  useEffect(() => {
    if (!channelId) return;
    oldestCursor.current = null;
    hasMore.current = true;

    api
      .get<{ messages: Message[] }>(`/channels/${channelId}/messages?limit=${PAGE_SIZE}`)
      .then(({ messages: fetched }) => {
        setMessages(channelId, fetched);
        if (fetched.length > 0) {
          oldestCursor.current = fetched[0].created_at;
        }
        if (fetched.length < PAGE_SIZE) hasMore.current = false;
      })
      .catch(() => {});
  }, [channelId, setMessages]);

  const loadMore = useCallback(async () => {
    if (!channelId || !hasMore.current || !oldestCursor.current) return;

    const { messages: older } = await api.get<{ messages: Message[] }>(
      `/channels/${channelId}/messages?limit=${PAGE_SIZE}&before=${oldestCursor.current}`
    );
    prependMessages(channelId, older);
    if (older.length > 0) oldestCursor.current = older[0].created_at;
    if (older.length < PAGE_SIZE) hasMore.current = false;
  }, [channelId, prependMessages]);

  return { msgs, loadMore, hasMore: hasMore.current, appendMessage, updateMessage, softDeleteMessage };
}
