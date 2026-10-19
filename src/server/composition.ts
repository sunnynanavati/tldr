import { z } from 'zod';
import { wordCount } from '../shared/summary';
import { SemanticRunSchema, FocusedTextSchema, focusedRuns, joinSemanticParts, type AnnotatedSummary } from './emphasis';

// A required insertion slot inside the lead sentence prevents append-only output.
// Further parts may insert details in other sentences or add supporting sentences.
export function compositionSchema(levelCount: number, targets?: number[]) {
  const runs = z.array(SemanticRunSchema).min(1).max(20);
  const part = FocusedTextSchema.extend({ appearsAt: z.number().int().min(0).max(levelCount - 1), cueRole: z.enum(['qualifier', 'supporting']) }).strict();
  const detail = z.object({ appearsAt: z.number().int().min(1).max(Math.max(1, levelCount - 1)), runs }).strict();
  const composition = z.object({
    lead: z.object({ subject: runs.describe('The shared subject of the lead sentence, included at every level.'), details: z.array(detail).min(levelCount > 1 ? 1 : 0).max(levelCount > 1 ? 1 : 0), predicate: FocusedTextSchema.describe('Shared predicate with a REQUIRED central takeaway cue, and any surrounding prose. Contains the main verb and its complement. Included at every level after the inserted detail.') }).strict(),
    tail: z.array(part).max(60).describe(targets
      ? `Use MULTIPLE parts per level as needed. Complete cumulative word targets: ${targets.join(', ')}. Added-word budgets by appearsAt 0–4: ${targets.map((target, i) => target - (targets[i - 1] ?? 0)).join(', ')} (level 0 includes the lead). For a long article, include distinct supporting facts across the whole source; do not compress all projects or findings into one generic list. An 800-word result may need 25–40 parts, not four.`
      : 'Ordered supporting facts; multiple parts may share an appearsAt level.'),
  }).strict();
  // Empty compositions signal already-concise text; otherwise exactly one plan.
  return z.object({ compositions: z.array(composition).max(1) }).strict();
}
export type Composition = z.infer<ReturnType<typeof compositionSchema>>;
export function composeLevels(plan: Composition, levelCount: number): AnnotatedSummary {
  const composition = plan.compositions[0];
  if (!composition) return { levels: [] };
  const { lead, tail } = composition;
  const predicate = focusedRuns(lead.predicate);
  if (!wordCount(lead.subject.map(run => run.text).join('')) || !wordCount(lead.predicate.takeaway)) {
    throw new Error('The lead must contain shared words on both sides of its insertion slot.');
  }
  const parts = [{ appearsAt: 0, runs: lead.subject }, ...lead.details, { appearsAt: 0, runs: predicate }, ...tail.map(part => ({ appearsAt: part.appearsAt, runs: focusedRuns(part, part.cueRole) }))];
  return { levels: Array.from({ length: levelCount }, (_, level) => ({
    runs: joinSemanticParts(parts.filter(part => part.appearsAt <= level).map(part => part.runs)),
  })) };
}
