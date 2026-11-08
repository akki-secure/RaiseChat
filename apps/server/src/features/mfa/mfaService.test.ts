import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

const query = vi.fn();
const clientQuery = vi.fn();
vi.mock('../../config/db.js', () => ({
  default: { query: (...a: unknown[]) => query(...a), connect: async () => ({ query: clientQuery, release: vi.fn() }) },
}));

import {
  getLockRemainingMs, recordFailure, regenerateRecoveryCodes, consumeRecoveryCode,
  MAX_FAILED_ATTEMPTS, LOCK_MINUTES, RECOVERY_CODE_COUNT,
} from './mfaService.js';

beforeEach(() => { query.mockReset(); clientQuery.mockReset(); });

describe('ロック', () => {
  it('locked_until が未来なら残り時間を返す', async () => {
    query.mockResolvedValue({ rows: [{ locked_until: new Date(Date.now() + 60_000) }] });
    expect(await getLockRemainingMs('u1')).toBeGreaterThan(0);
  });
  it('NULL や過去なら 0', async () => {
    query.mockResolvedValue({ rows: [{ locked_until: null }] });
    expect(await getLockRemainingMs('u1')).toBe(0);
    query.mockResolvedValue({ rows: [{ locked_until: new Date(Date.now() - 1000) }] });
    expect(await getLockRemainingMs('u1')).toBe(0);
  });
  it('recordFailure は上限と分数を渡し、locked_until があれば locked: true', async () => {
    query.mockResolvedValue({ rows: [{ locked_until: new Date(Date.now() + 60_000) }] });
    expect(await recordFailure('u1')).toEqual({ locked: true });
    expect(query.mock.calls[0][1]).toEqual(['u1', MAX_FAILED_ATTEMPTS, LOCK_MINUTES]);
  });
  it('locked_until が NULL なら locked: false', async () => {
    query.mockResolvedValue({ rows: [{ locked_until: null }] });
    expect(await recordFailure('u1')).toEqual({ locked: false });
  });
});

describe('regenerateRecoveryCodes', () => {
  it('8個の重複しないコードを返し、DBにはハッシュだけを保存する', async () => {
    clientQuery.mockResolvedValue({ rows: [] });
    const codes = await regenerateRecoveryCodes('u1');
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    codes.forEach((c) => expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/));

    const sqls = clientQuery.mock.calls.map((c) => c[0] as string);
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls[1]).toContain('invalidated_at = NOW()'); // 古いコードの無効化
    expect(sqls.at(-1)).toBe('COMMIT');
    const inserted = clientQuery.mock.calls
      .filter((c) => String(c[0]).startsWith('INSERT'))
      .map((c) => c[1][1] as string);
    expect(inserted).toHaveLength(RECOVERY_CODE_COUNT);
    inserted.forEach((h) => { expect(codes).not.toContain(h); expect(h.startsWith('$2')).toBe(true); });
  });
  it('途中で失敗したら ROLLBACK して例外を投げる', async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith('INSERT')) throw new Error('db error');
      return { rows: [] };
    });
    await expect(regenerateRecoveryCodes('u1')).rejects.toThrow('db error');
    expect(clientQuery.mock.calls.map((c) => c[0])).toContain('ROLLBACK');
  });
});

describe('consumeRecoveryCode', () => {
  let hash: string;
  beforeEach(async () => { hash = await bcrypt.hash('ABCDE-FGHIJ', 4); });

  it('小文字・前後の空白があっても一致し、使用済みにする', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'r1', code_hash: hash }] })
         .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'r1' }] });
    expect(await consumeRecoveryCode('u1', '  abcde-fghij ')).toBe(true);
    expect(String(query.mock.calls[1][0])).toContain('used_at = NOW()');
  });
  it('間違ったコードは false で、使用済みにしない', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'r1', code_hash: hash }] });
    expect(await consumeRecoveryCode('u1', 'ZZZZZ-ZZZZZ')).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('同時に使われて UPDATE が0件なら false（二重使用防止）', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'r1', code_hash: hash }] })
         .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    expect(await consumeRecoveryCode('u1', 'ABCDE-FGHIJ')).toBe(false);
  });
});
