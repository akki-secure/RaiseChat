'use client';

import { useEffect, useRef, useState } from 'react';
import { useNotificationStore } from './useNotificationStore';
import { AppNotification } from './types';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

const typeStyle: Record<AppNotification['type'], { label: string; bg: string; color: string }> = {
  new:    { label: '新着', bg: '#1d4ed8', color: '#fff' },
  urgent: { label: '緊急', bg: '#dc2626', color: '#fff' },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, markRead, markAllRead, remove, unreadCount } = useNotificationStore();
  const count = unreadCount();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleItemClick(n: AppNotification) {
    markRead(n.id);
    if (n.href) { window.location.href = n.href; setOpen(false); }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* ベルボタン */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative' }}
        className="p-2 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-gray-700"
        aria-label="通知"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 16, height: 16, padding: '0 3px',
            borderRadius: 9999, backgroundColor: '#ef4444',
            color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* ドロップダウン */}
      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          marginTop: 8,
          width: '340px',
          backgroundColor: '#1e2433',
          border: '1px solid #374151',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          {/* ヘッダー */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #374151',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16, color: '#818cf8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#f9fafb' }}>通知</span>
              {count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: '1px 7px', borderRadius: 9999,
                  backgroundColor: '#ef4444', color: '#fff',
                }}>
                  {count}
                </span>
              )}
            </div>
            {count > 0 && (
              <button
                onClick={markAllRead}
                style={{ fontSize: 12, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#a5b4fc')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#818cf8')}
              >
                すべて既読
              </button>
            )}
          </div>

          {/* 通知リスト */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              /* 空状態 */
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 12, padding: '40px 24px',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 9999,
                  backgroundColor: '#2d3748',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 28, height: 28, color: '#4b5563' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#d1d5db', margin: 0 }}>通知はありません</p>
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>新着・緊急の通知がここに届きます</p>
                </div>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => {
                const ts = typeStyle[n.type];
                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 16px',
                      borderBottom: '1px solid #2d3748',
                      cursor: 'pointer',
                      backgroundColor: n.read ? 'transparent' : 'rgba(99,102,241,0.06)',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2d3748')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = n.read ? 'transparent' : 'rgba(99,102,241,0.06)')}
                  >
                    {/* 種別バッジ */}
                    <span style={{
                      flexShrink: 0, marginTop: 2,
                      fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 4,
                      backgroundColor: ts.bg, color: ts.color,
                      whiteSpace: 'nowrap',
                    }}>
                      {ts.label}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: n.read ? 400 : 600,
                        color: n.read ? '#9ca3af' : '#f3f4f6',
                        margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {n.title}
                      </p>
                      <p style={{
                        fontSize: 12, color: '#6b7280', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {n.body}
                      </p>
                      <p style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <span style={{
                        flexShrink: 0, marginTop: 6,
                        width: 8, height: 8, borderRadius: 9999,
                        backgroundColor: '#6366f1',
                      }} />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                      style={{
                        flexShrink: 0, background: 'none', border: 'none',
                        color: '#4b5563', cursor: 'pointer', padding: 4, borderRadius: 4,
                        fontSize: 12, lineHeight: 1,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#9ca3af')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#4b5563')}
                      aria-label="削除"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
