import pool from '../../config/db.js';

/** この回数の警告が溜まると、オーナーがキックできるようになる（自動ではキックされない） */
export const KICK_WARNING_THRESHOLD = 3;

/** 取り消されていない警告の数 */
export async function countActiveWarnings(workspaceId: string, userId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM member_warnings
     WHERE workspace_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [workspaceId, userId]
  );
  return rows[0].n;
}

/** キック可能か。警告が閾値以上、またはオーナーが重大違反(severe)と指定した場合 */
export function canKick(warningCount: number, severe: boolean): boolean {
  return severe || warningCount >= KICK_WARNING_THRESHOLD;
}
