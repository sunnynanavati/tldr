import { describe, expect, it } from 'vitest';
import { SummaryRequestSchema, SummaryResponseSchema, levelCounts, lengthTargets, modelSummarySchema, restrainEmphasis, summaryText, validateSummary, wordCount } from '../src/shared/summary';
import { fixtureSource, fixtureLevels, shortSource, shortLevels, chineseSource, chineseLevels } from '../src/dev/fixtures';

describe('summary contract', () => {
  it('preserves the five complete lengths with middle-sentence expansion', () => {
    expect(levelCounts(fixtureLevels)).toEqual([20, 35, 50, 80, 110]);
    for (let i = 1; i < 5; i++) expect(summaryText(fixtureLevels, i).startsWith(summaryText(fixtureLevels, i - 1))).toBe(false);
    expect(validateSummary({ requestId: crypto.randomUUID(), text: fixtureSource }, { levels: fixtureLevels }).wordCounts).toEqual([20, 35, 50, 80, 110]);
  });
  it('counts Unicode words and punctuation without requiring spaces', () => {
    expect(wordCount('Hello, world!')).toBe(2);
    expect(wordCount('你好世界')).toBeGreaterThan(1);
    expect(wordCount('  \n … 🎉 ')).toBe(0);
    expect(validateSummary({ requestId: crypto.randomUUID(), text: chineseSource }, { levels: chineseLevels }).levels).toHaveLength(1);
  });
  it('scales targets and uses one segment for short selections', () => {
    expect(lengthTargets(200)).toEqual([20, 35, 55, 80, 110]);
    expect(lengthTargets(40).at(-1)).toBeLessThan(40);
    expect(lengthTargets(39)).toHaveLength(1);
    expect(validateSummary({ requestId: crypto.randomUUID(), text: shortSource }, { levels: shortLevels }).levels).toHaveLength(1);
  });
  it('grows article detail while keeping the essential summary quick', () => {
    expect(lengthTargets(1000)).toEqual([45, 80, 125, 182, 250]);
    expect(lengthTargets(3000)).toEqual([60, 140, 300, 545, 750]);
    expect(lengthTargets(10000)).toEqual([60, 140, 300, 550, 800]);
    let previous = [0, 0, 0, 0, 0];
    for (let source = 40; source <= 40000; source++) {
      const targets = lengthTargets(source);
      expect(targets.every((count, i) => count >= previous[i]! && (i === 0 || count > targets[i - 1]!))).toBe(true);
      expect(targets.at(-1)!).toBeLessThan(source);
      previous = targets;
    }
  });
  it('allows distributed highlights throughout article-length summaries', () => {
    const levels = [60, 140, 300, 550, 800].map(count => ({ runs: Array.from({ length: count / 10 }, (_, i) => [
      { text: `Finding ${i}`, emphasis: true },
      { text: ' adds evidence while preserving uncertainty about later outcomes. ', emphasis: false },
    ]).flat() }));
    const guarded = restrainEmphasis(levels[4]!);
    expect(guarded.runs.filter(run => run.emphasis).length).toBeGreaterThan(50);
    expect(restrainEmphasis(guarded).runs.filter(run => run.emphasis)).toEqual(guarded.runs.filter(run => run.emphasis));
    expect(SummaryResponseSchema.safeParse({ requestId: crypto.randomUUID(), levels, wordCounts: levelCounts(levels) }).success).toBe(true);
  });
  it('constrains provider output to the requested number of levels or already-concise output', () => {
    const long = modelSummarySchema(wordCount(fixtureSource));
    const short = modelSummarySchema(wordCount(shortSource));
    expect(long.safeParse({ levels: fixtureLevels }).success).toBe(true);
    expect(long.safeParse({ levels: fixtureLevels.slice(0, 4) }).success).toBe(false);
    expect(long.safeParse({ levels: shortLevels }).success).toBe(false);
    expect(short.safeParse({ levels: shortLevels }).success).toBe(true);
    expect(short.safeParse({ levels: fixtureLevels }).success).toBe(false);
    expect(short.safeParse({ levels: [] }).success).toBe(true);
  });
  it('rejects empty or oversized selections and fabricated counts', () => {
    expect(SummaryRequestSchema.safeParse({ requestId: crypto.randomUUID(), text: ' '.repeat(10) }).success).toBe(false);
    expect(SummaryRequestSchema.safeParse({ requestId: crypto.randomUUID(), text: 'x'.repeat(40_001) }).success).toBe(false);
    expect(SummaryResponseSchema.safeParse({ requestId: crypto.randomUUID(), levels: fixtureLevels, wordCounts: [1, 2, 3, 4, 5] }).success).toBe(false);
  });
  it('rejects duplicate-length levels, excess levels, and output longer than the source', () => {
    expect(() => validateSummary({ requestId: crypto.randomUUID(), text: shortSource }, { levels: fixtureLevels })).toThrow();
    expect(SummaryResponseSchema.safeParse({ requestId: crypto.randomUUID(), levels: [{ runs: [{ text: '...', emphasis: false }] }], wordCounts: [0] }).success).toBe(false);
    expect(() => validateSummary({ requestId: crypto.randomUUID(), text: fixtureSource }, { levels: fixtureLevels.slice(0, 4) })).toThrow();
  });
});
