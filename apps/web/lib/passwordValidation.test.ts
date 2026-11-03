import { describe, it, expect } from 'vitest';
import { validatePassword } from './passwordValidation';

describe('validatePassword', () => {
  it('有効なパスワードを通過させる', () => {
    expect(validatePassword('MyP@ss1234')).toEqual({ valid: true, error: null });
    expect(validatePassword('xK#9mN2$q')).toEqual({ valid: true, error: null });
  });

  it('8文字未満はエラー', () => {
    const result = validatePassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/8文字以上/);
  });

  it('100文字超過はエラー', () => {
    const long = 'Aa1!' + 'a'.repeat(97);
    const result = validatePassword(long);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/100文字以内/);
  });

  it('英字なしはエラー', () => {
    const result = validatePassword('12345678!');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/英字/);
  });

  it('数字なしはエラー', () => {
    const result = validatePassword('Password!@');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/数字/);
  });

  it('記号なしはエラー', () => {
    const result = validatePassword('Password1');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/記号/);
  });

  it('ブロックリストのパスワードはエラー（記号・数字を含む弱いパスワード）', () => {
    // p@ssw0rd: 英字・数字・記号すべて含み8文字だがブロックリスト入り
    const result = validatePassword('p@ssw0rd');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/セキュリティリスク/);
  });

  it('ブロックリストの大文字版もエラー', () => {
    // P@SSW0RD: 大文字でも同様にブロック
    const result = validatePassword('P@SSW0RD');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/セキュリティリスク/);
  });
});
