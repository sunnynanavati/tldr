import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { lengthTargets, wordCount, type SummaryRequest, type ModelSummary } from '../shared/summary';
import { compositionSchema, composeLevels } from './composition';
import { compactSummarySchema, compactLevels, highlightSummary, HighlightCoverageError, type AnnotatedSummary } from './emphasis';
import { serviceError } from './errors';
import { summaryInstructions } from './prompt';

export const DEFAULT_REASONING_EFFORT: 'none' | 'low' = 'none';
// The composition sends shared prose once, with structured semantic annotations.
export const summaryOutputBudget = (targets: number[]): number => Math.max(4000, Math.min(14000, 1200 + targets.at(-1)! * 14));
export interface SummaryProvider {
  summarize(request: SummaryRequest, signal: AbortSignal): Promise<ModelSummary>;
}
export function createOpenAIProvider(apiKey: string, model = 'gpt-6-luna', inspectPlan?: (summary: AnnotatedSummary) => void, effort: 'none' | 'low' = DEFAULT_REASONING_EFFORT): SummaryProvider {
  const client = new OpenAI({ apiKey, maxRetries: 0 });
  return {
    async summarize(request, signal) {
      const sourceWords = wordCount(request.text);
      const targets = lengthTargets(sourceWords);
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await client.responses.parse({
          model, reasoning: { effort }, store: false, max_output_tokens: summaryOutputBudget(targets),
          instructions: summaryInstructions(sourceWords, targets) + (attempt ? '\nCORRECTION: The previous attempt left substantial added text without enough usable highlights. At EACH expansion, mark new complete cues across the newly introduced facts (roughly 20–30% of added words). Keep cues short and grammatical; never end them in an article or preposition. Do not spend all annotations on the shared lead. Give each new sentence its own useful cue.' : ''),
          input: [{ role: 'user', content: request.text }],
          text: { format: targets.length === 1 ? zodTextFormat(compactSummarySchema(), 'tldr_summary') : zodTextFormat(compositionSchema(targets.length, targets), 'tldr_composition') },
        }, { signal });
        if (response.status !== 'completed') throw serviceError(502, 'incomplete', 'The summary did not finish. Try again.');
        if (!response.output_parsed) throw serviceError(422, 'refused', 'This selection could not be summarized. Try again or select a different passage.');
        const parsed = response.output_parsed;
        try {
          const summary = 'levels' in parsed ? compactLevels(parsed) : composeLevels(parsed, targets.length);
          inspectPlan?.(summary);
          return highlightSummary(summary);
        } catch (error) {
          if (error instanceof HighlightCoverageError && attempt === 0) continue;
          // Generated output validation is not a connection failure.
          throw serviceError(502, 'invalid_summary', 'The summary needs another attempt. Try again.');
        }
      }
      throw serviceError(502, 'invalid_summary', 'The summary needs another attempt. Try again.');
    },
  };
}
