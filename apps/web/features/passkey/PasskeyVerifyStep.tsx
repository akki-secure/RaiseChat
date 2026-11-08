'use client';

import { useState } from 'react';
import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { api } from '@/lib/api';
import { VerifyResult } from '@/features/mfa/types';

interface Props {
  onResult: (r: VerifyResult) => void;
}

export default function PasskeyVerifyStep({ onResult }: Props) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    setLoading(true);
    setError('');
    try {
      const optionsJSON = await api.post<PublicKeyCredentialRequestOptionsJSON>('/passkey/authenticate/options', {});
      const response = await startAuthentication({ optionsJSON });
      onResult(await api.post<VerifyResult>('/passkey/authenticate/verify', { response }));
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('認証がキャンセルされました。もう一度お試しください');
      } else {
        setError(err instanceof Error ? err.message : 'パスキー認証に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <div className="text-3xl mb-2">👆</div>
        <p className="text-sm text-gray-400">
          指紋認証（Touch ID など）で<br />本人確認を行います
        </p>
      </div>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      <button
        type="button"
        onClick={handleVerify}
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
      >
        {loading ? '確認中…' : 'パスキーで認証'}
      </button>
    </div>
  );
}
