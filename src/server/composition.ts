import { z } from 'zod';
import { wordCount } from '../shared/summary';
import { SemanticRunSchema, FocusedTextSchema, focusedRuns, joinSemanticParts, HighlightCoverageError, type AnnotatedRun, type AnnotatedSummary } from './emphasis';

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

// Long compositions use only inline runs. A separate required `takeaway`
// string was sometimes interpreted as a label after an already complete
// sentence, producing fragments such as ". assessed alternatives.".
export function articleCompositionSchema() {
  const runs = z.array(SemanticRunSchema).min(1).max(40);
  return z.object({ compositions: z.array(z.object({
    lead: z.object({
      subject: runs,
      details: z.array(z.object({ appearsAt: z.number().int().min(1).max(4), runs }).strict()).length(1),
      predicate: runs.describe('The actual shared sentence predicate, in reading order. Mark its main action/finding with role takeaway. No separate label or repeated cue.'),
    }).strict(),
    tail: z.array(z.object({ appearsAt: z.number().int().min(0).max(4), runs }).strict()).max(60),
  }).strict()).max(1) }).strict();
}
export function composeArticleLevels(plan: z.infer<ReturnType<typeof articleCompositionSchema>>): AnnotatedSummary {
  const composition = plan.compositions[0];
  if (!composition) return { levels: [] };
  const { lead, tail } = composition;
  const core = lead.predicate.findIndex(run => run.role === 'takeaway');
  if (core < 0) throw new HighlightCoverageError('The shared predicate needs an inline takeaway run containing the main action or finding.');
  const predicate: AnnotatedRun[] = lead.predicate.map((run, i) => i === core ? { text: run.text, role: 'core' } : run);
  const parts = [{ appearsAt: 0, runs: lead.subject }, ...lead.details, { appearsAt: 0, runs: predicate }, ...tail];
  return { levels: Array.from({ length: 5 }, (_, level) => ({
    runs: joinSemanticParts(parts.filter(part => part.appearsAt <= level).map(part => part.runs)),
  })) };
}
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
