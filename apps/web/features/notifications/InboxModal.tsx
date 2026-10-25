'use client';

import { useState } from 'react';
import { useNotificationStore } from './useNotificationStore';
import { AppNotification } from './types';

type Tab = 'all' | 'new' | 'urgent' | 'unread';

const tabs: { key: Tab; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'new', label: '新着' },
  { key: 'urgent', label: '緊急' },
  { key: 'unread', label: '未読' },
];

const typeMeta: Record<AppNotification['type'], { label: string; bg: string; text: string }> = {
  new: { label: '新着', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  urgent: { label: '緊急', bg: 'bg-red-500/20', text: 'text-red-400' },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return new Date(iso).toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  onClose: () => void;
}

export default function InboxModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('all');
  const { notifications, markRead, markAllRead, remove, clearAll, unreadCount } =
    useNotificationStore();
  const unread = unreadCount();

  const filtered = notifications.filter((n) => {
    if (tab === 'all') return true;
    if (tab === 'unread') return !n.read;
    return n.type === tab;
  });

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1000 }}
      className="flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{ width: 560, maxWidth: 'calc(100vw - 2rem)', maxHeight: 'calc(100vh - 4rem)' }}
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m4 0v1a4 4 0 008 0v-1"
              />
            </svg>
            <h2 className="text-base font-semibold text-white">受信ボックス</h2>
            {unread > 0 && (
              <span className="text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              >
                すべて既読
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-gray-500 hover:text-gray-400 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              >
                全削除
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
              aria-label="閉じる"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-700 flex-shrink-0">
          {tabs.map((t) => {
            const cnt =
              t.key === 'all'
                ? notifications.length
                : t.key === 'unread'
                ? notifications.filter((n) => !n.read).length
                : notifications.filter((n) => n.type === t.key).length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                  tab === t.key
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {t.label}
                {cnt > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1 rounded-full ${
                      tab === t.key
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 通知リスト */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10 mb-2 opacity-30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4"
                />
              </svg>
              <p className="text-sm">表示する通知がありません</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((n) => {
                const meta = typeMeta[n.type];
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                      n.read
                        ? 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800/70'
                        : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
                    }`}
                    onClick={() => {
                      markRead(n.id);
                      if (n.href) {
                        window.location.href = n.href;
                        onClose();
                      }
                    }}
                  >
                    {/* 種別アイコン */}
                    <div className={`flex-shrink-0 rounded-lg p-2 ${meta.bg}`}>
                      {n.type === 'urgent' ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`w-4 h-4 ${meta.text}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`w-4 h-4 ${meta.text}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                          />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold ${meta.text}`}>
                          {meta.label}
                        </span>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-sm font-medium ${
                          n.read ? 'text-gray-400' : 'text-white'
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[11px] text-gray-600 mt-1.5">{timeAgo(n.createdAt)}</p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(n.id);
                      }}
                      className="flex-shrink-0 p-1 text-gray-600 hover:text-gray-400 rounded transition-colors"
                      aria-label="削除"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
