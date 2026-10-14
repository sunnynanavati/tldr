import { describe, expect, it } from 'vitest';
import { highlightSummary } from '../src/server/emphasis';
import { levelText } from '../src/shared/summary';
const model = (text: string) => ({ levels: [{ runs: [{ text, emphasis: false }] }] });
const highlights = (text: string, candidates: string[]) => highlightSummary(model(text), candidates).levels[0]!.runs.filter(run => run.emphasis).map(run => run.text);

describe('explicit summary keywords', () => {
  it('highlights model-selected keywords when all composition flags are false', () => {
    const text = 'Rajiv and Sanjana’s marriage, opposed by their families’ criminal ties, drives a series of schemes to unite them and reform Uday and Manju.';
    expect(highlights(text, ['Rajiv', 'criminal ties'])).toEqual(['Rajiv', 'criminal ties']);
    expect(levelText(highlightSummary(model(text), ['Rajiv']).levels[0]!)).toBe(text);
  });
  it('keeps a shared keyword in every summary length', () => {
    const levels = ['Attention shapes focus.', 'Attention shapes focus through our daily surroundings.'].map(text => model(text).levels[0]!);
    expect(highlightSummary({ levels }, ['Attention']).levels.every(level => level.runs.some(run => run.emphasis))).toBe(true);
  });
  it('normalizes trailing punctuation without dropping a valid keyword', () => {
    expect(highlights('Daily routines make it easier to sustain attention.', ['attention.'])).toEqual(['attention']);
  });
  it('rejects missing, substring-only, and whole-sentence highlights', () => {
    expect(() => highlights('An article explains a useful daily practice.', ['art'])).toThrow();
    expect(() => highlights('Focus matters. Other routines make deliberate choices easier each day.', ['Focus matters'])).toThrow();
    expect(() => highlights('Attention shapes focus.', [])).toThrow();
  });
  it('handles Unicode keywords, short summaries, and already-concise results', () => {
    expect(highlights('图书馆延长开放时间，方便上班族。', ['图书馆'])).toEqual(['图书馆']);
    expect(highlights('Focus matters.', ['Focus'])).toEqual(['Focus']);
    expect(highlightSummary({ levels: [] }, ['unused'])).toEqual({ levels: [] });
  });
});
