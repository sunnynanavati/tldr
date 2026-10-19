import { describe, expect, it } from 'vitest';
import { matchWords } from '../src/ui/word-diff';
import { restrainEmphasis, levelText, wordCount } from '../src/shared/summary';

describe('word reconciliation', () => {
  it('preserves shared words on both sides of an inserted phrase', () => {
    expect([...matchWords(['The', 'library', 'extends', 'hours.'], ['The', 'library', 'extends', 'evening', 'hours.'])]).toEqual([[0, 0], [1, 1], [2, 2], [4, 3]]);
  });
  it('matches repeated words in order without reusing a node', () => {
    const result = matchWords(['a', 'b', 'a', 'b'], ['a', 'a', 'b']);
    expect([...result.values()]).toEqual([0, 2, 3]);
  });
  it('supports removal, replacement, and empty text', () => {
    expect([...matchWords(['a', 'new', 'detail', 'here'], ['a', 'here'])]).toEqual([[0, 0], [1, 3]]);
    expect(matchWords(['old'], ['new']).size).toBe(0);
    expect(matchWords([], ['new']).size).toBe(0);
  });
});
describe('restrained emphasis', () => {
  it('removes sentence emphasis without modifying text', () => {
    const level = { runs: [{ text: 'An entire sentence should never be highlighted.', emphasis: true }] };
    const result = restrainEmphasis(level);
    expect(levelText(result)).toBe(levelText(level)); expect(result.runs[0]!.emphasis).toBe(false);
  });
  it('removes whole-sentence emphasis even when punctuation is in a separate run', () => {
    const result = restrainEmphasis({ runs: [
      { text: 'Focus matters', emphasis: true },
      { text: '. Small changes to daily routines can help people make more deliberate choices and reduce distractions.', emphasis: false },
    ] });
    expect(result.runs[0]!.emphasis).toBe(false);
  });
  it('treats adjacent highlighted runs as one phrase', () => {
    const result = restrainEmphasis({ runs: [{ text: 'One two three ', emphasis: true }, { text: 'four five six', emphasis: true }] });
    expect(result.runs.every(run => !run.emphasis)).toBe(true);
  });
  it('keeps short keywords within a thirty-five percent budget', () => {
    const result = restrainEmphasis({ runs: [
      { text: 'Attention', emphasis: true }, { text: ' depends on our surroundings and small daily changes to ', emphasis: false },
      { text: 'defaults', emphasis: true }, { text: ' can help.', emphasis: false },
    ] });
    expect(result.runs.filter(run => run.emphasis).map(run => run.text)).toEqual(['Attention', 'defaults']);
    expect(wordCount(result.runs.filter(run => run.emphasis).map(run => run.text).join(' '))).toBeLessThanOrEqual(Math.ceil(wordCount(levelText(result)) * .35));
  });
});
