'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import InvitePanel from '@/features/invite/InvitePanel';
import MemberModerationPanel from './MemberModerationPanel';

interface Props {
  workspaceId: string;
  meId: string;
  onClose: () => void;
}

type Tab = 'invite' | 'members';

// ワークスペース管理（owner 向け）。画面中央モーダルの3層構造
export default function AdminModal({ workspaceId, meId, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('invite');

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

  const tabClass = (t: Tab) =>
    `text-sm font-medium py-3 mr-6 border-b-2 ${
      tab === t ? 'text-white border-indigo-500' : 'text-gray-400 border-transparent hover:text-white'
    }`;

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
          role="dialog"
          aria-label="ワークスペース管理"
          className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 flex flex-col"
          style={{ width: '520px', maxWidth: 'calc(100vw - 2rem)', maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
            <h2 className="text-lg font-bold text-white">ワークスペース管理</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="閉じる">✕</button>
          </div>
          <div className="flex border-b border-gray-700 px-6 flex-shrink-0">
            <button className={tabClass('invite')} onClick={() => setTab('invite')}>招待</button>
            <button className={tabClass('members')} onClick={() => setTab('members')}>メンバー管理</button>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 p-6">
            {tab === 'invite' ? (
              <InvitePanel workspaceId={workspaceId} />
            ) : (
              <MemberModerationPanel workspaceId={workspaceId} meId={meId} />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
