import { describe, expect, it } from 'vitest';
import { SummaryRequestSchema, SummaryResponseSchema, cumulativeCounts, lengthTargets, summaryText, validateSummary, wordCount } from '../src/shared/summary';
import { fixtureSource, fixtureSegments, shortSource, shortSegments, chineseSource, chineseSegments } from '../src/dev/fixtures';

describe('summary contract', () => {
  it('preserves the approved five lengths and immutable shared text', () => {
    expect(cumulativeCounts(fixtureSegments)).toEqual([20, 35, 56, 83, 111]);
    for (let i = 1; i < 5; i++) expect(summaryText(fixtureSegments, i).startsWith(summaryText(fixtureSegments, i - 1))).toBe(true);
    expect(validateSummary({ requestId: crypto.randomUUID(), text: fixtureSource }, { segments: fixtureSegments }).wordCounts).toEqual([20, 35, 56, 83, 111]);
  });
  it('counts Unicode words and punctuation without requiring spaces', () => {
    expect(wordCount('Hello, world!')).toBe(2);
    expect(wordCount('你好世界')).toBeGreaterThan(1);
    expect(wordCount('  \n … 🎉 ')).toBe(0);
    expect(validateSummary({ requestId: crypto.randomUUID(), text: chineseSource }, { segments: chineseSegments }).segments).toHaveLength(1);
  });
  it('scales targets and uses one segment for short selections', () => {
    expect(lengthTargets(200)).toEqual([20, 35, 55, 80, 110]);
    expect(lengthTargets(40).at(-1)).toBeLessThan(40);
    expect(lengthTargets(39)).toHaveLength(1);
    expect(validateSummary({ requestId: crypto.randomUUID(), text: shortSource }, { segments: shortSegments }).segments).toHaveLength(1);
  });
  it('rejects empty or oversized selections and fabricated counts', () => {
    expect(SummaryRequestSchema.safeParse({ requestId: crypto.randomUUID(), text: ' '.repeat(10) }).success).toBe(false);
    expect(SummaryRequestSchema.safeParse({ requestId: crypto.randomUUID(), text: 'x'.repeat(40_001) }).success).toBe(false);
    expect(SummaryResponseSchema.safeParse({ requestId: crypto.randomUUID(), segments: fixtureSegments, wordCounts: [1, 2, 3, 4, 5] }).success).toBe(false);
  });
  it('rejects duplicate-length levels, excess levels, and output longer than the source', () => {
    expect(() => validateSummary({ requestId: crypto.randomUUID(), text: shortSource }, { segments: fixtureSegments })).toThrow();
    expect(SummaryResponseSchema.safeParse({ requestId: crypto.randomUUID(), segments: [{ runs: [{ text: '...', emphasis: false }] }], wordCounts: [0] }).success).toBe(false);
    expect(() => validateSummary({ requestId: crypto.randomUUID(), text: fixtureSource }, { segments: fixtureSegments.slice(0, 4) })).toThrow();
  });
});
