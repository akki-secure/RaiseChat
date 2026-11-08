'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onSelect: (file: File) => void;
  disabled?: boolean;
}

export default function AttachMenuButton({ onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 無効化されたらメニューも閉じる
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <button
        type="button"
        aria-label="添付メニューを開く"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-lg leading-none text-gray-300 hover:bg-gray-600 hover:text-white disabled:opacity-40 mb-0.5 transition-colors"
      >
        +
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 w-52 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              inputRef.current?.click();
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700"
          >
            ファイルをアップロード
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
        data-testid="file-input"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = ''; // 同じファイルを再選択できるようにする
        }}
      />
    </div>
  );
}
