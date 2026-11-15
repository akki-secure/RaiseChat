import { describe, it, expect } from 'vitest';
import { safeNextPath, withNext } from './safeNext';

describe('safeNextPath', () => {
  it('招待ページのパスは許可する', () => {
    expect(safeNextPath('/invite/abc123DEF')).toBe('/invite/abc123DEF');
  });
  it('未指定・空は / にする', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });
  it('外部サイトや、招待以外のパスは / にする', () => {
    expect(safeNextPath('https://evil.example/invite/abc')).toBe('/');
    expect(safeNextPath('//evil.example/invite/abc')).toBe('/');
    expect(safeNextPath('/workspace/new')).toBe('/');
    expect(safeNextPath('/invite/')).toBe('/');
    expect(safeNextPath('/invite/abc/../../x')).toBe('/');
    expect(safeNextPath('/invite/abc?x=1')).toBe('/');
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
  });
});

describe('withNext', () => {
  it('戻り先が無ければそのまま', () => {
    expect(withNext('/auth/login', '/')).toBe('/auth/login');
  });
  it('戻り先があれば ?next= を付ける', () => {
    expect(withNext('/auth/login', '/invite/abc')).toBe('/auth/login?next=%2Finvite%2Fabc');
  });
});
