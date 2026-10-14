import { createOpenAIProvider } from '../src/server/provider';
import { levelCounts, validateSummary, wordCount } from '../src/shared/summary';
import { fixtureSource, shortSource, chineseSource } from '../src/dev/fixtures';
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.log('SKIPPED: Set OPENAI_API_KEY in .env to run the live AI smoke test. No API calls made.');
} else {
  const provider = createOpenAIProvider(apiKey, process.env.OPENAI_MODEL);
  for (const [name, text] of [['long', fixtureSource], ['short', shortSource], ['Chinese', chineseSource]] as const) {
    const request = { requestId: crypto.randomUUID(), text };
    const model = await provider.summarize(request, AbortSignal.timeout(20_000));
    console.log(`${name}: source ${wordCount(text)} words · received ${model.levels.length} levels · counts ${levelCounts(model.levels).join(', ')}`);
    const result = validateSummary(request, model);
    console.log(`${name}: ${result.levels.length} levels · counts ${result.wordCounts.join(', ')}`);
    // Authored, public fixtures only. Output supports manual fidelity review.
    console.log(result.levels.map(segment => segment.runs.map(run => run.text).join('')).join(' '));
  }
}
