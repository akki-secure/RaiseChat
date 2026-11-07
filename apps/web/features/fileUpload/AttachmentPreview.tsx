'use client';

import { UploadedAttachment } from './types';

interface Props {
  attachments: UploadedAttachment[];
  uploading?: boolean;
  onRemove: (index: number) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function AttachmentPreview({ attachments, uploading, onRemove }: Props) {
  if (attachments.length === 0 && !uploading) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {attachments.map((a, i) => (
        <div key={a.url} className="relative bg-gray-900 border border-gray-700 rounded-lg p-1">
          {a.file_type.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.url} alt={a.name ?? '添付画像'} className="h-16 w-16 object-cover rounded" />
          ) : (
            <div className="h-16 w-28 flex flex-col justify-center px-2 text-xs text-gray-300">
              <span className="truncate">{a.name ?? 'ファイル'}</span>
              <span className="text-gray-500">{formatSize(a.size)}</span>
            </div>
          )}
          <button
            type="button"
            aria-label="添付を削除"
            onClick={() => onRemove(i)}
            className="absolute -top-2 -right-2 bg-gray-700 hover:bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-none"
          >
            ×
          </button>
        </div>
      ))}
      {uploading && (
        <div role="status" className="h-16 w-16 flex items-center justify-center text-xs text-gray-400 border border-dashed border-gray-600 rounded-lg">
          アップロード中…
        </div>
      )}
    </div>
  );
}
