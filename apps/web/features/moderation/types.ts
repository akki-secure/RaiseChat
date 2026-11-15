export interface MemberRow {
  id: string;
  username: string;
  display_name: string | null;
  role: 'owner' | 'member';
}

export interface RemovedMember {
  id: string;
  username: string;
  display_name: string | null;
  removed_at: string;
  removed_reason: string | null;
}

export interface WarningsResponse {
  warnings: { id: string; reason: string; created_at: string; revoked_at: string | null }[];
  active_count: number;
  threshold: number;
}

/** キックボタンを押せるか。警告が閾値に達しているか、重大違反としてチェックされているとき */
export function canKickNow(activeCount: number, threshold: number, severe: boolean): boolean {
  return severe || activeCount >= threshold;
}
