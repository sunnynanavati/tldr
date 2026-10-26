import { describe, expect, it } from 'vitest';
import { localTokenIssue } from '../src/shared/connection';

describe('local pairing credentials', () => {
  it('rejects a provider key before the browser can save or transmit it', () => {
    const key = ['sk', 'proj', 'synthetic'].join('-') + 'x'.repeat(40);
    expect(localTokenIssue(key)).toContain('OpenAI API key');
    expect(localTokenIssue(key)).not.toContain(key);
  });
  it('accepts generated local tokens and rejects malformed credentials', () => {
    expect(localTokenIssue('a'.repeat(64))).toBeNull();
    for (const token of ['', 'a'.repeat(31), 'a'.repeat(513), 'a'.repeat(32) + '\n']) expect(localTokenIssue(token)).not.toBeNull();
  });
});
