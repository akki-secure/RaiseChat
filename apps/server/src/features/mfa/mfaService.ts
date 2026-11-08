import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import pool from '../../config/db.js';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const RECOVERY_CODE_COUNT = 8;

// ---- 失敗回数ロック ----
export async function getLockRemainingMs(userId: string): Promise<number> {
  const { rows } = await pool.query('SELECT locked_until FROM users WHERE id = $1', [userId]);
  const until = rows[0]?.locked_until ? new Date(rows[0].locked_until).getTime() : 0;
  return Math.max(0, until - Date.now());
}

// 失敗を1回記録。5回目でロックし、カウンタを0に戻す
export async function recordFailure(userId: string): Promise<{ locked: boolean }> {
  const { rows } = await pool.query(
    `UPDATE users SET
       locked_until = CASE WHEN failed_2fa_attempts + 1 >= $2
                           THEN NOW() + make_interval(mins => $3) ELSE locked_until END,
       failed_2fa_attempts = CASE WHEN failed_2fa_attempts + 1 >= $2
                                  THEN 0 ELSE failed_2fa_attempts + 1 END
     WHERE id = $1
     RETURNING locked_until`,
    [userId, MAX_FAILED_ATTEMPTS, LOCK_MINUTES]
  );
  const until = rows[0]?.locked_until ? new Date(rows[0].locked_until).getTime() : 0;
  return { locked: until > Date.now() };
}

export async function resetFailures(userId: string): Promise<void> {
  await pool.query('UPDATE users SET failed_2fa_attempts = 0, locked_until = NULL WHERE id = $1', [userId]);
}

// ---- リカバリーコード ----
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字(0/O,1/I)を除く
  const pick = () => alphabet[crypto.randomInt(alphabet.length)];
  const part = () => Array.from({ length: 5 }, pick).join('');
  return `${part()}-${part()}`;
}

// 再発行: 未使用の古いコードを無効化し、新しい8個を返す（平文はこの1回だけ）
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateCode);
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE recovery_codes SET invalidated_at = NOW() WHERE user_id = $1 AND used_at IS NULL AND invalidated_at IS NULL',
      [userId]
    );
    for (const h of hashes) {
      await client.query('INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)', [userId, h]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return codes;
}

export async function countActiveRecoveryCodes(userId: string): Promise<number> {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL AND invalidated_at IS NULL',
    [userId]
  );
  return rows[0].n;
}

// 一致したコードを使用済みにする（二重使用はWHEREで防ぐ）
export async function consumeRecoveryCode(userId: string, input: string): Promise<boolean> {
  const code = input.trim().toUpperCase();
  const { rows } = await pool.query(
    'SELECT id, code_hash FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL AND invalidated_at IS NULL',
    [userId]
  );
  for (const r of rows) {
    if (await bcrypt.compare(code, r.code_hash)) {
      const u = await pool.query(
        'UPDATE recovery_codes SET used_at = NOW() WHERE id = $1 AND used_at IS NULL RETURNING id',
        [r.id]
      );
      return (u.rowCount ?? 0) > 0;
    }
  }
  return false;
}
