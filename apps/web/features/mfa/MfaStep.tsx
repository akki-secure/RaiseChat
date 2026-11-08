'use client';

import { useState } from 'react';
import { User } from '@/stores/useAppStore';
import TotpVerifyStep from '@/features/totp/TotpVerifyStep';
import PasskeyVerifyStep from '@/features/passkey/PasskeyVerifyStep';
import RecoveryCodeStep from './RecoveryCodeStep';
import { Method, VerifyResult } from './types';

interface Props {
  methods: Method[];            // ログイン時に server が返した、使える手段
  mode: 'any' | 'both';
  onSuccess: (user: User) => void;
  onBack: () => void;
}

const LABEL: Record<Method, string> = { totp: '認証アプリ', passkey: 'パスキー' };

export default function MfaStep({ methods, mode, onSuccess, onBack }: Props) {
  const [available, setAvailable] = useState<Method[]>(methods);
  const [selected, setSelected] = useState<Method>(methods[0]);
  const [recovery, setRecovery] = useState(false);

  // 認証結果: 完了なら onSuccess、「両方必須」で残りがあれば次の手段へ
  function handleResult(r: VerifyResult) {
    if (r.user) { onSuccess(r.user); return; }
    if (r.remaining && r.remaining.length > 0) {
      setAvailable(r.remaining);
      setSelected(r.remaining[0]);
    }
  }

  if (recovery) {
    return <RecoveryCodeStep onSuccess={onSuccess} onBack={() => setRecovery(false)} />;
  }

  return (
    <div className="space-y-4">
      {mode === 'both' && (
        <p className="text-xs text-yellow-400 text-center">
          2段階認証（{methods.map((m) => LABEL[m]).join('・')}）をすべて完了する必要があります
        </p>
      )}

      {/* 「どちらか一方」で手段が複数あるときだけ切り替えを表示 */}
      {mode === 'any' && available.length > 1 && (
        <div className="flex gap-2">
          {available.map((m) => (
            <button key={m} type="button" onClick={() => setSelected(m)}
              className={`flex-1 text-sm rounded-lg py-2 transition-colors ${
                selected === m ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}>
              {LABEL[m]}
            </button>
          ))}
        </div>
      )}

      {selected === 'totp' ? (
        <TotpVerifyStep onResult={handleResult} onBack={onBack} />
      ) : (
        <>
          <PasskeyVerifyStep onResult={handleResult} />
          <button type="button" onClick={onBack}
            className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← パスワード入力に戻る
          </button>
        </>
      )}

      <button type="button" onClick={() => setRecovery(true)}
        className="w-full text-xs text-indigo-400 hover:underline">
        認証できない場合：リカバリーコードを使う
      </button>
    </div>
  );
}
