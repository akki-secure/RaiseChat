'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';

interface Props {
  onClose: () => void;
  onEnabled: () => void;
}

export default function TotpSetupModal({ onClose, onEnabled }: Props) {
  const [qrDataURL, setQrDataURL] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function loadSetup() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<{ qrDataURL: string; secret: string }>('/totp/setup');
      setQrDataURL(data.qrDataURL);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable() {
    if (code.length !== 6) { setError('6桁のコードを入力してください'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/totp/enable', { code });
      setDone(true);
      onEnabled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'コードが正しくありません');
    } finally {
      setLoading(false);
    }
  }

  // マウント時にQRコード取得 + 背景スクロール禁止
  useEffect(() => {
    loadSetup();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modal = (
    <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center">
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* モーダルカード — 画面中央に固定 */}
      <div className="relative bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-[420px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-1">2段階認証の設定</h2>
          <p className="text-sm text-gray-400 mb-5">
            Google Authenticator などのアプリで QR コードを読み取り、<br />
            表示された6桁コードを入力してください。
          </p>

          {done ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-green-400 font-medium mb-5">2段階認証を有効にしました</p>
              <button
                onClick={onClose}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 transition-colors"
              >
                閉じる
              </button>
            </div>
          ) : loading && !qrDataURL ? (
            <div className="text-center text-gray-400 py-8">読み込み中…</div>
          ) : error && !qrDataURL ? (
            /* APIエラーで QR コードが取得できなかった場合 */
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🔐</div>
              <p className="text-yellow-400 font-medium mb-5">{error}</p>
              <button
                onClick={onClose}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg py-2.5 transition-colors"
              >
                閉じる
              </button>
            </div>
          ) : (
            <>
              {/* QRコード（小さめに表示） */}
              {qrDataURL && (
                <div className="flex justify-center mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataURL} alt="TOTP QR Code" className="w-36 h-36 rounded-lg bg-white p-1" />
                </div>
              )}

              {/* 6桁コード入力 */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">認証アプリに表示された6桁コード</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-full bg-gray-800 text-white text-center text-xl tracking-widest rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {error && qrDataURL && <p className="text-red-400 text-sm mb-3">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg py-2.5 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleEnable}
                  disabled={loading || code.length !== 6}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
                >
                  {loading ? '確認中…' : '有効にする'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // document.body 直下にレンダリングしてサイドバーの制約を抜け出す
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
