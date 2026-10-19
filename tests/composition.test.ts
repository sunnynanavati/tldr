import { expect, it } from 'vitest';
import { composeLevels, compositionSchema } from '../src/server/composition';
import type { SemanticRun } from '../src/server/emphasis';
const summaryText = (levels: { runs: { text: string }[] }[], index: number) => levels[index]!.runs.map(run => run.text).join('');
const runs = (text: string): SemanticRun[] => [{ text, role: 'plain' }];
const focus = (takeaway: string) => ({ before: [], takeaway, after: [] });
const composition = { lead: {
  subject: runs('The library extends'), details: [{ appearsAt: 1, runs: runs(' its evening') }], predicate: focus(' hours.'),
}, tail: [{ appearsAt: 2, ...focus(' Staffing costs'), after: runs(' also rise.'), cueRole: 'supporting' as const }] };
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
  expect(() => composeLevels({ compositions: [{ ...composition, lead: { ...composition.lead, predicate: focus('.') } }] }, 5)).toThrow();
});
it('separates generated clause boundaries without splitting highlighted core wording', () => {
  const lead = {
    subject: [{ text: 'The council', role: 'subject' as const }],
    details: [{ appearsAt: 1, runs: [{ text: ', after safety checks,', role: 'plain' as const }] }],
    predicate: { before: [], takeaway: 'postponed the bridge', after: [{ text: '.', role: 'plain' as const }] },
  };
  const { levels } = composeLevels({ compositions: [{ lead, tail: [{ appearsAt: 1, ...focus('Opening is delayed'), after: runs('.'), cueRole: 'supporting' as const }] }] }, 2);
  expect(summaryText(levels, 0)).toBe('The council postponed the bridge.');
  expect(summaryText(levels, 1)).toBe('The council, after safety checks, postponed the bridge. Opening is delayed.');
});

it('preserves annotated source-run identity across expansion levels', () => {
  const subject = { text: 'The library', role: 'subject' as const };
  const predicate = focus(' extends its hours');
  const result = composeLevels({ compositions: [{ lead: { subject: [subject], details: [{ appearsAt: 1, runs: [{ text: ', serving evening students,', role: 'plain' }] }], predicate }, tail: [] }] }, 2);
  expect(result.levels[0]!.runs).toContain(subject);
  expect(result.levels[1]!.runs).toContain(subject);
  const main = result.levels[0]!.runs.find(run => run.role === 'core');
  expect(main?.text).toBe(predicate.takeaway);
  expect(result.levels[1]!.runs).toContain(main);
});
