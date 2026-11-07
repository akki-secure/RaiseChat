'use client';

import { useRef } from 'react';

interface Props {
  onSelect: (file: File) => void;
  disabled?: boolean;
}

export default function FileAttachButton({ onSelect, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label="ファイルを添付"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex-shrink-0 text-gray-400 hover:text-gray-200 disabled:opacity-40 px-1 py-1.5 mb-0.5 transition-colors"
      >
        📎
      </button>
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
    </>
  );
}
