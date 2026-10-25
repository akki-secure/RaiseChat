'use client';

import { useState } from 'react';
import NotificationBell from './NotificationBell';
import InboxModal from './InboxModal';
import { useNotificationStore } from './useNotificationStore';

export default function TopBar() {
  const [showInbox, setShowInbox] = useState(false);
  const { notifications } = useNotificationStore();
  const unreadInbox = notifications.filter((n) => !n.read).length;

  return (
    <>
      <header
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          padding: '6px 12px',
          backgroundColor: '#111827',
          borderBottom: '1px solid #1f2937',
          flexShrink: 0,
        }}
      >
        {/* 受信ボックスアイコン */}
        <button
          onClick={() => setShowInbox(true)}
          style={{ position: 'relative' }}
          className="p-2 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-gray-700"
          aria-label="受信ボックス"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m4 0v1a4 4 0 008 0v-1" />
          </svg>
          {unreadInbox > 0 && (
            <span
              style={{
                position: 'absolute', top: 2, right: 2,
                minWidth: 16, height: 16,
                padding: '0 3px',
                borderRadius: 9999,
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unreadInbox > 99 ? '99+' : unreadInbox}
            </span>
          )}
        </button>

        {/* 通知ベルアイコン */}
        <NotificationBell />
      </header>

      {showInbox && <InboxModal onClose={() => setShowInbox(false)} />}
    </>
  );
}
