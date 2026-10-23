import { describe, it, expect } from 'vitest';
import { escapeHtml } from './sanitize.js';

describe('escapeHtml', () => {
  it('HTMLの特殊文字をエスケープする', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('& をエスケープする', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it("シングルクォートをエスケープする", () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('エスケープ不要な文字はそのまま返す', () => {
    expect(escapeHtml('Hello, World!')).toBe('Hello, World!');
  });

  it('空文字を返す', () => {
    expect(escapeHtml('')).toBe('');
  });
});
