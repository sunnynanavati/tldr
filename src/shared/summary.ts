import { z } from 'zod';

export const MAX_INPUT_CHARS = 40_000;
export const SHORT_PASSAGE_WORDS = 40;
export const levelNames = ['Essential', 'Concise', 'Balanced', 'Expanded', 'Detailed'] as const;
export const RunSchema = z.object({ text: z.string().min(1).max(4000), emphasis: z.boolean() }).strict();
export const SegmentSchema = z.object({ runs: z.array(RunSchema).min(1).max(80) }).strict();
// Empty provider output is a deliberate "already concise" signal, never a successful API response.
export const ModelSummarySchema = z.object({ segments: z.array(SegmentSchema).max(5) }).strict();
export function modelSummarySchema(sourceWords: number) {
  const count = sourceWords < SHORT_PASSAGE_WORDS ? 1 : 5;
  return z.object({ segments: z.union([
    z.array(SegmentSchema).length(0),
    z.array(SegmentSchema).length(count),
  ]) }).strict();
}
export const SummaryRequestSchema = z.object({
  requestId: z.string().uuid(), text: z.string().trim().min(1).max(MAX_INPUT_CHARS),
}).strict();
export const SummaryResponseSchema = z.object({
  requestId: z.string().uuid(), segments: z.array(SegmentSchema).min(1).max(5),
  wordCounts: z.array(z.number().int().min(1).max(999)).min(1).max(5),
}).strict().superRefine((value, ctx) => {
  if (![1, 5].includes(value.segments.length) || value.wordCounts.length !== value.segments.length) {
    ctx.addIssue({ code: 'custom', message: 'Expected one or five summary levels.' });
  }
  const expected = cumulativeCounts(value.segments);
  if (expected.some((count, i) => count !== value.wordCounts[i] || (i > 0 && count <= expected[i - 1]!))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid summary word counts.' });
  }
});
export type SummarySegment = z.infer<typeof SegmentSchema>;
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
export const segmentText = (segment: SummarySegment): string => segment.runs.map(run => run.text).join('');
export const summaryText = (segments: SummarySegment[], level = segments.length - 1): string =>
  segments.slice(0, level + 1).map(segmentText).join(' ');
export const cumulativeCounts = (segments: SummarySegment[]): number[] =>
  segments.map((_, i) => wordCount(summaryText(segments, i)));
export function lengthTargets(sourceWords: number): number[] {
  if (sourceWords < SHORT_PASSAGE_WORDS) return [Math.max(1, Math.floor(sourceWords * 0.55))];
  const ratio = Math.min(1, Math.floor(sourceWords * 0.72) / 110);
  return [20, 35, 55, 80, 110].map(target => Math.round(target * ratio));
}
export function validateSummary(request: SummaryRequest, model: ModelSummary): SummaryResult {
  const sourceWords = wordCount(request.text);
  const expected = sourceWords < SHORT_PASSAGE_WORDS ? 1 : 5;
  const result = SummaryResponseSchema.parse({
    requestId: request.requestId, segments: model.segments, wordCounts: cumulativeCounts(model.segments),
  });
  if (result.segments.length !== expected || result.wordCounts.at(-1)! >= sourceWords) {
    throw new Error('The summary must have the requested levels and be shorter than the selection.');
  }
  return result;
}
