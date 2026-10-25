import { create } from 'zustand';

export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: UserStatus;
  totp_enabled?: boolean;
  has_security_question?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  role: 'owner' | 'member';
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  type: 'public' | 'private';
  created_by: string;
}

export interface Attachment {
  id: string;
  url: string;
  file_type: string;
  size: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  user?: User;
  attachments?: Attachment[];
  reactions?: Reaction[];
  reply_count?: number;
}

export interface DM {
  id: string;
  workspace_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender?: User;
}

interface AppState {
  me: User | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  channels: Channel[];
  activeChannelId: string | null;
  messages: Record<string, Message[]>;
  threadParentId: string | null;
  onlineUserIds: Set<string>;
  dmPartnerIds: string[];

  setMe: (user: User | null) => void;
  setWorkspaces: (ws: Workspace[]) => void;
  setActiveWorkspace: (id: string) => void;
  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (id: string | null) => void;
  setMessages: (channelId: string, msgs: Message[]) => void;
  prependMessages: (channelId: string, msgs: Message[]) => void;
  appendMessage: (channelId: string, msg: Message) => void;
  updateMessage: (channelId: string, msg: Message) => void;
  softDeleteMessage: (channelId: string, msgId: string) => void;
  setThreadParent: (msgId: string | null) => void;
  setOnlineUserIds: (ids: string[]) => void;
  setUserOnline: (id: string) => void;
  setUserOffline: (id: string) => void;
  setDmPartnerIds: (ids: string[]) => void;
  addReaction: (channelId: string, msgId: string, emoji: string) => void;
  removeReaction: (channelId: string, msgId: string, emoji: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  me: null,
  workspaces: [],
  activeWorkspaceId: null,
  channels: [],
  activeChannelId: null,
  messages: {},
  threadParentId: null,
  onlineUserIds: new Set(),
  dmPartnerIds: [],

  setMe: (user) => set({ me: user }),
  setWorkspaces: (ws) => set({ workspaces: ws }),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id, channels: [], activeChannelId: null, messages: {} }),
  setChannels: (channels) => set({ channels }),
  setActiveChannel: (id) => set({ activeChannelId: id, threadParentId: null }),
  setMessages: (channelId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [channelId]: msgs } })),
  prependMessages: (channelId, msgs) =>
    set((s) => ({
      messages: { ...s.messages, [channelId]: [...msgs, ...(s.messages[channelId] ?? [])] },
    })),
  appendMessage: (channelId, msg) =>
    set((s) => ({
      messages: { ...s.messages, [channelId]: [...(s.messages[channelId] ?? []), msg] },
    })),
  updateMessage: (channelId, updated) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).map((m) => (m.id === updated.id ? updated : m)),
      },
    })),
  softDeleteMessage: (channelId, msgId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).map((m) =>
          m.id === msgId ? { ...m, deleted_at: new Date().toISOString() } : m
        ),
      },
    })),
  setThreadParent: (msgId) => set({ threadParentId: msgId }),
  setOnlineUserIds: (ids) => set({ onlineUserIds: new Set(ids) }),
  setUserOnline: (id) =>
    set((s) => ({ onlineUserIds: new Set([...s.onlineUserIds, id]) })),
  setUserOffline: (id) =>
    set((s) => {
      const next = new Set(s.onlineUserIds);
      next.delete(id);
      return { onlineUserIds: next };
    }),
  setDmPartnerIds: (ids) => set({ dmPartnerIds: ids }),
  addReaction: (channelId, msgId, emoji) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).map((m) => {
          if (m.id !== msgId) return m;
          const reactions = m.reactions ?? [];
          const existing = reactions.find((r) => r.emoji === emoji);
          if (existing) {
            return {
              ...m,
              reactions: reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r
              ),
            };
          }
          return { ...m, reactions: [...reactions, { emoji, count: 1, reacted: true }] };
        }),
      },
    })),
  removeReaction: (channelId, msgId, emoji) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).map((m) => {
          if (m.id !== msgId) return m;
          const reactions = (m.reactions ?? [])
            .map((r) =>
              r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r
            )
            .filter((r) => r.count > 0);
          return { ...m, reactions };
        }),
      },
    })),
}));
