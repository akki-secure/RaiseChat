'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import AttachMenuButton from '@/features/fileUpload/AttachMenuButton';
import AttachmentPreview from '@/features/fileUpload/AttachmentPreview';
import { UploadedAttachment } from '@/features/fileUpload/types';

interface Props {
  placeholder?: string;
  onSend: (content: string, attachments?: UploadedAttachment[]) => void | Promise<void>;
  /** true のとき ＋ 添付メニューを表示する（チャンネルのみ） */
  allowAttachments?: boolean;
}

const MAX_ATTACHMENTS = 5;

export default function MessageInput({ placeholder = 'メッセージを入力…', onSend, allowAttachments = false }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || uploading) return;
    const sentAttachments = attachments;
    const result = sentAttachments.length > 0
      ? onSend(trimmed, sentAttachments.map(({ url, file_type, size }) => ({ url, file_type, size })))
      : onSend(trimmed);
    setText('');
    setAttachments([]);
    setUploadError(null);
    setSendError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    // 失敗したら入力内容を戻して理由を表示する。戻すのは、その間に新しく打ち始めていない場合だけ
    Promise.resolve(result).catch((e) => {
      setText((cur) => (cur === '' ? trimmed : cur));
      setAttachments((cur) => (cur.length === 0 ? sentAttachments : cur));
      setSendError(e instanceof Error ? e.message : '送信に失敗しました');
    });
  }

  async function handleSelect(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const uploaded = await api.upload(file);
      setAttachments((prev) => [...prev, { ...uploaded, name: file.name }]);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
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
      <div className="bg-gray-800 rounded-xl px-4 py-2 border border-gray-700 focus-within:border-indigo-500 transition-colors">
      <AttachmentPreview
        attachments={attachments}
        uploading={uploading}
        onRemove={(i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="flex items-end gap-2">
        {allowAttachments && (
          <AttachMenuButton
            onSelect={handleSelect}
            disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
          />
        )}
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
          disabled={(!text.trim() && attachments.length === 0) || uploading}
          className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors mb-0.5"
        >
          送信
        </button>
      </div>
      </div>
      {uploadError && <p role="alert" className="mt-1 text-xs text-red-400">{uploadError}</p>}
      {sendError && <p role="alert" className="mt-1 text-xs text-red-400">{sendError}</p>}
      <p className="mt-1 text-xs text-gray-600">送信ボタンで送信 / Enter で改行</p>
    </div>
  );
}
