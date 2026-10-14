import { z } from 'zod';

export const MAX_INPUT_CHARS = 40_000;
export const SHORT_PASSAGE_WORDS = 40;
export const levelNames = ['Essential', 'Concise', 'Balanced', 'Expanded', 'Detailed'] as const;
export const RunSchema = z.object({ text: z.string().min(1).max(4000), emphasis: z.boolean() }).strict();
export const LevelSchema = z.object({ runs: z.array(RunSchema).min(1).max(80) }).strict();
// Empty provider output is a deliberate "already concise" signal, never a successful API response.
export const ModelSummarySchema = z.object({ levels: z.array(LevelSchema).max(5) }).strict();
export function modelSummarySchema(sourceWords: number) {
  const count = sourceWords < SHORT_PASSAGE_WORDS ? 1 : 5;
  return z.object({ levels: z.union([
    z.array(LevelSchema).length(0),
    z.array(LevelSchema).length(count),
  ]) }).strict();
}
export const SummaryRequestSchema = z.object({
  requestId: z.string().uuid(), text: z.string().trim().min(1).max(MAX_INPUT_CHARS),
}).strict();
export const SummaryResponseSchema = z.object({
  requestId: z.string().uuid(), levels: z.array(LevelSchema).min(1).max(5),
  wordCounts: z.array(z.number().int().min(1).max(999)).min(1).max(5),
}).strict().superRefine((value, ctx) => {
  if (![1, 5].includes(value.levels.length) || value.wordCounts.length !== value.levels.length) {
    ctx.addIssue({ code: 'custom', message: 'Expected one or five summary levels.' });
  }
  const expected = levelCounts(value.levels);
  if (expected.some((count, i) => count !== value.wordCounts[i] || (i > 0 && count <= expected[i - 1]!))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid summary word counts.' });
  }
});
export type SummaryLevel = z.infer<typeof LevelSchema>;
export type ModelSummary = z.infer<typeof ModelSummarySchema>;
export type SummaryRequest = z.infer<typeof SummaryRequestSchema>;
export type SummaryResult = z.infer<typeof SummaryResponseSchema>;

const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
export function wordCount(text: string): number {
  return [...segmenter.segment(text)].filter(part => part.isWordLike).length;
}
export function wordTokens(text: string): string[] {
  return [...segmenter.segment(text)].map(part => part.segment);
}
export const levelText = (segment: SummaryLevel): string => segment.runs.map(run => run.text).join('');
export const summaryText = (levels: SummaryLevel[], level = levels.length - 1): string =>
  levelText(levels[level]!);
export const levelCounts = (levels: SummaryLevel[]): number[] =>
  levels.map((_, i) => wordCount(summaryText(levels, i)));
export function lengthTargets(sourceWords: number): number[] {
  if (sourceWords < SHORT_PASSAGE_WORDS) return [Math.max(1, Math.floor(sourceWords * 0.55))];
  const ratio = Math.min(1, Math.floor(sourceWords * 0.72) / 110);
  return [20, 35, 55, 80, 110].map(target => Math.round(target * ratio));
}
export function validateSummary(request: SummaryRequest, model: ModelSummary): SummaryResult {
  const sourceWords = wordCount(request.text);
  const expected = sourceWords < SHORT_PASSAGE_WORDS ? 1 : 5;
  const result = SummaryResponseSchema.parse({
    requestId: request.requestId, levels: model.levels.map(restrainEmphasis), wordCounts: levelCounts(model.levels),
  });
  if (result.levels.length !== expected || result.wordCounts.at(-1)! >= sourceWords) {
    throw new Error('The summary must have the requested levels and be shorter than the selection.');
  }
  return result;
}

// Presentation guard: never let a provider turn whole sentences into highlights.
export function restrainEmphasis(level: SummaryLevel): SummaryLevel {
  const merged: SummaryLevel['runs'] = [];
  for (const run of level.runs) {
    const previous = merged.at(-1);
    if (previous?.emphasis === run.emphasis) previous.text += run.text;
    else merged.push({ ...run });
  }
  const text = levelText(level);
  let offset = 0;
  const ranges = merged.map(run => { const start = offset; offset += run.text.length; return { start, end: offset, emphasis: run.emphasis }; });
  const wholeSentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)].filter(sentence => {
    const words = [...segmenter.segment(sentence.segment)].filter(part => part.isWordLike);
    return words.length > 0 && words.every(word => ranges.some(range => range.emphasis
      && range.start <= sentence.index + word.index && range.end >= sentence.index + word.index + word.segment.length));
  });
  let budget = Math.max(1, Math.ceil(wordCount(text) * .2)), phrases = 0;
  return { runs: merged.map((run, index) => {
    const count = wordCount(run.text);
    const emphasis = run.emphasis && count > 0 && count <= 4 && count <= budget
      && phrases < 4 && !/[.!?。！？]/u.test(run.text)
      && !wholeSentences.some(sentence => ranges[index]!.start < sentence.index + sentence.segment.length && ranges[index]!.end > sentence.index);
    if (emphasis) { budget -= count; phrases++; }
    return { text: run.text, emphasis };
  }) };
}
