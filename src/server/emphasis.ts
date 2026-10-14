import { z } from 'zod';
import { levelText, restrainEmphasis, wordCount, type ModelSummary, type SummaryLevel } from '../shared/summary';

export const HighlightsSchema = z.array(z.string().min(1).max(80)).min(1).max(12)
  .describe('Required exact keywords or short phrases copied from the summary. The first is a single meaningful word present in every level.');

// Explicit model-selected keywords are projected onto each complete level. This
// avoids relying on sparse boolean flags scattered through the composition plan.
export function highlightSummary(model: ModelSummary, candidates: string[]): ModelSummary {
  const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
  return { levels: model.levels.map(level => {
    const text = levelText(level);
    const words = [...segmenter.segment(text)].filter(part => part.isWordLike);
    const starts = new Set(words.map(word => word.index));
    const ends = new Set(words.map(word => word.index + word.segment.length));
    const spans: { start: number; end: number }[] = [];
    for (const candidate of candidates) {
      // Ignore punctuation accidentally included around an otherwise valid keyword.
      const phrase = candidate.trim().replace(/^[\s.,!?。！？،;:]+|[\s.,!?。！？،;:]+$/gu, '');
      if (!phrase || wordCount(phrase) > 4) continue;
      let from = 0;
      while (from < text.length) {
        const start = text.indexOf(phrase, from); if (start < 0) break;
        const end = start + phrase.length;
        if (starts.has(start) && ends.has(end) && !spans.some(span => start < span.end && end > span.start)) {
          spans.push({ start, end }); break;
        }
        from = end;
      }
    }
    spans.sort((a, b) => a.start - b.start);
    const runs: SummaryLevel['runs'] = []; let offset = 0;
    for (const span of spans) {
      if (span.start > offset) runs.push({ text: text.slice(offset, span.start), emphasis: false });
      runs.push({ text: text.slice(span.start, span.end), emphasis: true }); offset = span.end;
    }
    if (offset < text.length) runs.push({ text: text.slice(offset), emphasis: false });
    const result = restrainEmphasis({ runs });
    // A one-word summary cannot highlight a keyword without highlighting all of it.
    if (words.length > 1 && !result.runs.some(run => run.emphasis)) {
      throw new Error('The model did not select a usable summary keyword.');
    }
    return result;
  }) };
}
