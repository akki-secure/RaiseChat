'use client';

import { useState, useRef } from 'react';

interface Props {
  placeholder?: string;
  onSend: (content: string) => void;
}

export default function MessageInput({ placeholder = 'メッセージを入力…', onSend }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  return (
    <div className="px-4 pb-4">
      <div className="flex items-end gap-2 bg-gray-800 rounded-xl px-4 py-2 border border-gray-700 focus-within:border-indigo-500 transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={handleInput}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none py-1"
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors mb-0.5"
        >
          送信
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-600">送信ボタンで送信 / Enter で改行</p>
    </div>
  );
}
