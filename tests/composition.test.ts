import { expect, it } from 'vitest';
import { composeLevels, compositionSchema } from '../src/server/composition';
import { summaryText } from '../src/shared/summary';
const runs = (text: string) => [{ text, emphasis: false }];
const composition = { lead: {
  subject: runs('The library extends'), details: [{ appearsAt: 1, runs: runs(' its evening') }], predicate: runs(' hours.'),
}, tail: [{ appearsAt: 2, runs: runs(' Staffing costs also rise.') }] };
it('composes middle insertions and appended sentences without rewriting base words', () => {
  const { levels } = composeLevels({ compositions: [composition] }, 3);
  expect(summaryText(levels, 0)).toBe('The library extends hours.');
  expect(summaryText(levels, 1)).toBe('The library extends its evening hours.');
  expect(summaryText(levels, 2)).toBe('The library extends its evening hours. Staffing costs also rise.');
});
it('requires middle expansion for long passages and bounds visibility levels', () => {
  expect(compositionSchema(5).safeParse({ compositions: [composition] }).success).toBe(true);
  expect(compositionSchema(1).safeParse({ compositions: [composition] }).success).toBe(false);
  expect(compositionSchema(5).safeParse({ compositions: [{ ...composition, lead: { ...composition.lead, details: [] } }] }).success).toBe(false);
  expect(composeLevels({ compositions: [] }, 5)).toEqual({ levels: [] });
  expect(() => composeLevels({ compositions: [{ ...composition, lead: { ...composition.lead, predicate: runs('.') } }] }, 5)).toThrow();
});
