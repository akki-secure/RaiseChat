import { describe, it, expect, beforeAll } from 'vitest';
import { signToken, verifyToken } from './jwt.js';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-unit-tests';
});

describe('jwt utils', () => {
  it('トークンを生成して検証できる', () => {
    const payload = { userId: 'user-123', username: 'testuser' };
    const token = signToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.username).toBe(payload.username);
  });

  it('改ざんされたトークンは拒否する', () => {
    const token = signToken({ userId: 'user-123', username: 'testuser' });
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });
});
