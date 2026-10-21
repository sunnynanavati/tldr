import { z } from 'zod';
import { levelText, restrainEmphasis, wordCount, cueWordCount, type ModelSummary, type SummaryLevel } from '../shared/summary';

// Semantic annotations live on the prose itself: no separately quoted phrases
// can drift away from the text when complete levels are assembled.
export const CueTextSchema = z.string().min(1).max(80)
  .regex(/^\s*(?:[^\s\u3040-\u30ff\u3400-\u9fff]+(?:\s+[^\s\u3040-\u30ff\u3400-\u9fff]+){0,5}|[^\s][\s\S]{0,10}[^\s]|[^\s])\s*$/)
  .describe('One complete short cue, retain necessary surrounding whitespace; at most six space-separated words, or at most twelve characters for CJK text. Split longer prose into plain runs and short meaningful cues.');
export const SemanticRunSchema = z.union([
  z.object({ text: z.string().min(1).max(4000), role: z.literal('plain') }).strict(),
  z.object({
    text: z.string().min(1).max(40).regex(/^\s*(?:[^\s\u3040-\u30ff\u3400-\u9fff]+(?:\s+[^\s\u3040-\u30ff\u3400-\u9fff]+){0,2}|[^\s][\s\S]{0,6}[^\s]|[^\s])\s*$/)
      .describe('A compact topic or actor: at most three space-separated words or eight CJK characters. Keep articles/connectors plain; retain spacing around the cue.'),
    role: z.literal('subject'),
  }).strict(),
  z.object({
    text: CueTextSchema,
    role: z.enum(['takeaway', 'qualifier', 'supporting', 'name'])
      .describe('name: a proper name present in the prose (person, organization, place, or named work), isolated from surrounding words; takeaway: core action/finding; qualifier: essential uncertainty/negation/condition/cause; supporting: useful additional information.'),
  }).strict(),
]);
export type SemanticRun = z.infer<typeof SemanticRunSchema>;
export type AnnotatedRun = SemanticRun | { text: string; role: 'core' };
export interface AnnotatedSummary { levels: { runs: AnnotatedRun[] }[] }
const CoreTextSchema = z.string().min(1).max(64)
  .regex(/^\s*(?:[^\s\u3040-\u30ff\u3400-\u9fff]+(?:\s+[^\s\u3040-\u30ff\u3400-\u9fff]+){0,4}|[^\s][\s\S]{0,6}[^\s]|[^\s])\s*$/)
  .describe('Required concise action/finding or concrete instruction: usually 2–4 words, at most five words/eight CJK characters. Never truncate an object or split a number from its unit; use before/after for surrounding prose.');
export const FocusedTextSchema = z.object({
  before: z.array(SemanticRunSchema).max(40),
  takeaway: CoreTextSchema.describe('Required main action/finding or concrete instruction, as a short complete cue. Include essential uncertainty or negation. This is part of the prose, not a separate quote.'),
  after: z.array(SemanticRunSchema).max(40),
}).strict();
export function compactSummarySchema() {
  return z.object({ levels: z.union([
    z.array(FocusedTextSchema).length(0), z.array(FocusedTextSchema).length(1),
  ]) }).strict();
}
export function focusedRuns(focus: z.infer<typeof FocusedTextSchema>, role: 'core' | 'qualifier' | 'supporting' = 'core'): AnnotatedRun[] {
  return joinSemanticParts([focus.before, [{ text: focus.takeaway, role }], focus.after]);
}
export function compactLevels(compact: z.infer<ReturnType<typeof compactSummarySchema>>): AnnotatedSummary {
  return { levels: compact.levels.map(level => ({ runs: focusedRuns(level) })) };
}
export function joinSemanticParts(parts: AnnotatedRun[][]): AnnotatedRun[] {
  const runs: AnnotatedRun[] = [];
  for (const part of parts) for (const run of part) {
    const preceding = runs.at(-1)?.text ?? '';
    // Generated runs are whole words/cues, never stems. Keep Latin words and
    // sentences separate while retaining natural unspaced CJK text.
    if (/[\p{Script=Latin}\p{N},;:.!?]$/u.test(preceding) && /^[\p{Script=Latin}\p{N}]/u.test(run.text)) runs.push({ text: ' ', role: 'plain' });
    runs.push(run);
  }
  return runs;
}
type Span = { start: number; end: number; priority: number; run: AnnotatedRun };
function renderSpans(text: string, spans: Span[]): SummaryLevel {
  const runs: SummaryLevel['runs'] = []; let offset = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start > offset) runs.push({ text: text.slice(offset, span.start), emphasis: false });
    runs.push({ text: text.slice(span.start, span.end), emphasis: true }); offset = span.end;
  }
  if (offset < text.length) runs.push({ text: text.slice(offset), emphasis: false });
  return restrainEmphasis({ runs });
}
function retainsSpans(level: SummaryLevel, spans: Span[]): boolean {
  let offset = 0;
  const ranges = level.runs.map(run => { const start = offset; offset += run.text.length; return { start, end: offset, emphasis: run.emphasis }; });
  return spans.every(span => ranges.some(range => range.emphasis && range.start <= span.start && range.end >= span.end));
}

// A distinct failure allows one bounded regeneration for sparse additions.
export class HighlightCoverageError extends Error {}

// Select semantic priority before text order. Shared annotated runs carry core
// meaning into every expanded level automatically, without re-quoting the text.
export function highlightSummary(model: AnnotatedSummary): ModelSummary {
  const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
  const priority = { core: 0, name: 0.5, takeaway: 1, qualifier: 2, subject: 3, supporting: 4 } as const;
  // Lock both highlighted and muted cues at their first appearance.
  const decisions = new WeakMap<AnnotatedRun, boolean>();
  return { levels: model.levels.map((level, index) => {
    const text = level.runs.map(run => run.text).join('');
    const words = [...segmenter.segment(text)].filter(part => part.isWordLike);
    const starts = new Set(words.map(word => word.index));
    const ends = new Set(words.map(word => word.index + word.segment.length));
    const seenNames = new Set<string>();
    const firstNames: Span[] = [];
    const candidates: Span[] = []; let offset = 0;
    for (const run of level.runs) {
      const base = offset; offset += run.text.length;
      if (run.role === 'plain') continue;
      if (!(run.role in priority)) throw new Error('Invalid summary annotation.');
      const phrase = run.text.replace(/^[\s.,!?。！？،;:]+|[\s.,!?。！？،;:]+$/gu, '');
      const phraseWords = [...segmenter.segment(phrase)].filter(part => part.isWordLike);
      if (!phraseWords.length || cueWordCount(phrase) > 6) continue;
      if (/\b(?:a|an|the|of|to|for|with|and|or|than|whether)$/iu.test(phrase)) continue;
      const start = base + run.text.indexOf(phrase), end = start + phrase.length;
      if (!starts.has(start + phraseWords[0]!.index) || !ends.has(start + phraseWords.at(-1)!.index + phraseWords.at(-1)!.segment.length)) continue;
      const span = { start, end, priority: priority[run.role], run };
      if (run.role === 'name') {
        const key = phrase.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ');
        const first = !seenNames.has(key);
        seenNames.add(key);
        if (first) firstNames.push(span);
        // An earlier insertion must not mute a name highlighted at a shorter
        // level. Otherwise repeated mentions need no extra emphasis.
        if (!first && decisions.get(run) !== true) continue;
      }
      candidates.push(span);
    }
    candidates.sort((a, b) => a.priority - b.priority || a.start - b.start);
    const spans = candidates.filter(span => decisions.get(span.run) === true);
    if (!retainsSpans(renderSpans(text, spans), spans)) throw new Error('Expanded summary cannot preserve existing highlights.');
    const coreRequired = level.runs.some(run => run.role === 'core');
    let hasTakeaway = spans.some(span => span.priority === 0 || (!coreRequired && span.priority === 1));
    for (const span of candidates) {
      if (decisions.has(span.run)) continue;
      const proposed = [...spans, span];
      // Do not allow a lower-priority cue to displace a later main finding.
      if (retainsSpans(renderSpans(text, proposed), proposed)) {
        spans.push(span); if (span.priority === 0 || (!coreRequired && span.priority === 1)) hasTakeaway = true;
      }
    }
    // Ask the provider to rebalance compact cues rather than silently discard
    // a first name mention when it competes with the presentation safeguards.
    if (!retainsSpans(renderSpans(text, spans), firstNames)) {
      throw new HighlightCoverageError('First mentions of names need short, usable highlights alongside the main takeaway.');
    }
    const addedWords = wordCount(level.runs.filter(run => !decisions.has(run)).map(run => run.text).join(''));
    const addedCues = spans.filter(span => !decisions.has(span.run));
    const addedHighlightedWords = addedCues.reduce((count, span) => count + wordCount(text.slice(span.start, span.end)), 0);
    // Do not silently return paragraphs whose new information has no skim cues.
    // Existing decisions stay fixed; the provider must improve the new prose's annotations.
    if (index > 0 && addedWords >= 12
      && (addedCues.length < Math.max(1, Math.floor(addedWords / 25)) || addedHighlightedWords < Math.max(1, Math.floor(addedWords * .12)))) {
      throw new HighlightCoverageError(`New details need complete, short highlights distributed through the added information. Level ${index} introduces ${addedWords} words, but only ${addedCues.length} usable new cues totaling ${addedHighlightedWords} highlighted words. This expansion needs at least ${Math.max(1, Math.floor(addedWords / 25))} distinct new cues and ${Math.max(1, Math.floor(addedWords * .12))} highlighted words. Split plain prose around meaningful 1–3-word cues in these newly introduced sentences; a single long cue cannot stand in for distributed annotations.`);
    }
    for (const run of level.runs) if (!decisions.has(run)) decisions.set(run, spans.some(span => span.run === run));
    const result = renderSpans(text, spans);
    if (words.length > 1 && !hasTakeaway) throw new HighlightCoverageError('The model did not annotate a usable summary highlight. Mark a short, complete main action or finding in the shared predicate; keep surrounding prose plain.');
    // Only text and boolean emphasis leave the provider boundary.
    if (levelText(result) !== text) throw new Error('Summary text changed while applying highlights.');
    return result;
  }) };
}
