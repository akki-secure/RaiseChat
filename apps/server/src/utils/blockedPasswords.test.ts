import { describe, it, expect } from 'vitest';
import { isBlockedPassword, blockedPasswords } from './blockedPasswords.js';

describe('isBlockedPassword', () => {
  it('ブロックリストのパスワードをブロックする', () => {
    expect(isBlockedPassword('password')).toBe(true);
    expect(isBlockedPassword('123456')).toBe(true);
    expect(isBlockedPassword('qwerty')).toBe(true);
  });

  it('大文字小文字を区別せずにブロックする', () => {
    expect(isBlockedPassword('PASSWORD')).toBe(true);
    expect(isBlockedPassword('Password')).toBe(true);
    expect(isBlockedPassword('QWERTY')).toBe(true);
  });

  it('ブロックリストにないパスワードは通過する', () => {
    expect(isBlockedPassword('MyUniqueP@ss99!')).toBe(false);
    expect(isBlockedPassword('xK#9mN2$qLp')).toBe(false);
  });

  it('空文字はブロックされない', () => {
    expect(isBlockedPassword('')).toBe(false);
  });

  it('blockedPasswords は Set として公開されている', () => {
    expect(blockedPasswords).toBeInstanceOf(Set);
    expect(blockedPasswords.size).toBeGreaterThan(0);
  });
});
