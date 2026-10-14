import { z } from 'zod';
import { RunSchema, wordCount, type ModelSummary } from '../shared/summary';

// A required insertion slot inside the lead sentence prevents append-only output.
// Further parts may insert details in other sentences or add supporting sentences.
export function compositionSchema(levelCount: number) {
  const runs = z.array(RunSchema).min(1).max(20);
  const part = z.object({ appearsAt: z.number().int().min(0).max(levelCount - 1), runs }).strict();
  const detail = z.object({ appearsAt: z.number().int().min(1).max(Math.max(1, levelCount - 1)), runs }).strict();
  const composition = z.object({
    lead: z.object({ subject: runs.describe('The shared subject of the lead sentence, included at every level.'), details: z.array(detail).min(levelCount > 1 ? 1 : 0).max(levelCount > 1 ? 1 : 0), predicate: runs.describe('The shared predicate of the lead sentence: a verb and its complement, not punctuation alone. Included at every level after the inserted details.') }).strict(),
    tail: z.array(part).max(60),
  }).strict();
  // Empty compositions signal already-concise text; otherwise exactly one plan.
  return z.object({ compositions: z.array(composition).max(1) }).strict();
}
export type Composition = z.infer<ReturnType<typeof compositionSchema>>;
export function composeLevels(plan: Composition, levelCount: number): ModelSummary {
  const composition = plan.compositions[0];
  if (!composition) return { levels: [] };
  const { lead, tail } = composition;
  if (!wordCount(lead.subject.map(run => run.text).join('')) || !wordCount(lead.predicate.map(run => run.text).join(''))) {
    throw new Error('The lead must contain shared words on both sides of its insertion slot.');
  }
  const parts = [{ appearsAt: 0, runs: lead.subject }, ...lead.details, { appearsAt: 0, runs: lead.predicate }, ...tail];
  return { levels: Array.from({ length: levelCount }, (_, level) => ({
    runs: parts.filter(part => part.appearsAt <= level).flatMap(part => part.runs.map(run => ({ ...run }))),
  })) };
}
