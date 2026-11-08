import { User } from '@/stores/useAppStore';

export type Method = 'totp' | 'passkey';

// /totp/verify と /passkey/authenticate/verify の共通レスポンス
export interface VerifyResult {
  user?: User;          // 認証完了
  remaining?: Method[]; // 「両方必須」で、まだ通す必要がある手段
}
