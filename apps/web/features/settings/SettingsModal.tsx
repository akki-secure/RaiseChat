'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import AccountSettings from './AccountSettings';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999 }}>
      {/* 背景オーバーレイ */}
      <div
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      />
      {/* 中央揃えラッパー */}
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div
          className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 flex flex-col"
          style={{ width: '480px', maxWidth: 'calc(100vw - 2rem)', maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
            <h2 className="text-lg font-bold text-white">設定</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="閉じる"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* タブ */}
          <div className="flex border-b border-gray-700 px-6 flex-shrink-0">
            <button className="text-sm font-medium text-white border-b-2 border-indigo-500 py-3 mr-6">
              アカウント
            </button>
          </div>

          {/* コンテンツ */}
          <div className="overflow-y-auto flex-1 min-h-0">
            <div className="p-6">
              <AccountSettings />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
