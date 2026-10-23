'use client';

import { useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Message } from '@/stores/useAppStore';
import Link from 'next/link';

export default function SearchPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const { messages } = await api.get<{ messages: Message[] }>(
        `/workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}`
      );
      setResults(messages);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="font-semibold text-white mb-3">メッセージ検索</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="キーワードを入力…"
            autoFocus
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            {loading ? '検索中…' : '検索'}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-4">
        {searched && results.length === 0 && (
          <p className="text-gray-500 text-sm mt-4">「{query}」に一致するメッセージはありませんでした。</p>
        )}
        {results.map((msg) => (
          <Link
            key={msg.id}
            href={`/workspace/${workspaceId}/channel/${msg.channel_id}`}
            className="block py-2 px-3 mb-2 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-semibold text-indigo-400">
                {msg.user?.display_name ?? msg.user?.username ?? '…'}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(msg.created_at).toLocaleString('ja-JP')}
              </span>
            </div>
            <p className="text-sm text-gray-200 line-clamp-2">{msg.content}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
