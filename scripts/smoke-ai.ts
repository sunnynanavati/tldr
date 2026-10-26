import { writeFile } from 'node:fs/promises';
import type { AnnotatedSummary } from '../src/server/emphasis';
import { createOpenAIProvider, DEFAULT_REASONING_EFFORT } from '../src/server/provider';
import { highlightBudget, levelNames, levelText, validateSummary, wordCount, cueWordCount } from '../src/shared/summary';
import { summaryCases } from './summary-cases';
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.log('SKIPPED: Set OPENAI_API_KEY in .env to run the live AI smoke test. No API calls made.');
} else {
  let rawPlan: AnnotatedSummary = { levels: [] };
  const effort = process.env.TLDR_EVAL_EFFORT === 'low' ? 'low' : process.env.TLDR_EVAL_EFFORT === 'none' ? 'none' : DEFAULT_REASONING_EFFORT;
  const provider = createOpenAIProvider(apiKey, process.env.OPENAI_MODEL, plans => { rawPlan = plans; }, effort);
  const report = ['# TLDR summary and highlight quality samples', '', `Reasoning effort: ${effort}.`, '', 'Generated from original, non-private fixture passages with the production prompt. These examples support manual semantic review; schema and budget checks do not prove factual fidelity or skim quality for all future passages.', ''];
  const cases = process.env.TLDR_EVAL_CASE ? summaryCases.filter(sample => sample.name === process.env.TLDR_EVAL_CASE) : summaryCases;
  for (const { name, text, skimCheck } of cases) {
    const request = { requestId: crypto.randomUUID(), text };
    const start = performance.now();
    const model = await provider.summarize(request, AbortSignal.timeout(20_000));
    const result = validateSummary(request, model);
    const seconds = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`${name}: ${result.levels.length} levels · counts ${result.wordCounts.join(', ')} · ${seconds}s`);
    report.push(`## ${name}`, '', `Source: ${wordCount(text)} words. Review goal: ${skimCheck}`, '', '<details><summary>Source passage</summary>', '', text, '', '</details>', '');
    for (const [index, level] of result.levels.entries()) {
      const phrases = level.runs.filter(run => run.emphasis).map(run => run.text);
      const highlightedWords = wordCount(phrases.join(' ')), totalWords = wordCount(levelText(level));
      if (totalWords > 1 && !phrases.length) throw new Error('Missing summary highlights');
      if (highlightedWords > highlightBudget(totalWords) || phrases.some(phrase => cueWordCount(phrase) > 6)) throw new Error('Highlight budget exceeded');
      const label = result.levels.length === 1 ? 'Compact' : levelNames[index];
      console.log(`${label}: ${phrases.join(' → ')} (${highlightedWords}/${totalWords} highlighted words)`);
      const rendered = level.runs.map(run => run.emphasis ? `**${run.text}**` : run.text).join('');
      report.push(`### ${label} · ${totalWords} words`, '', rendered, '', `Highlights only: ${phrases.join(' → ')}`, '', `Annotated cues (before presentation budget): ${JSON.stringify(rawPlan.levels[index]?.runs.filter(run => run.role !== 'plain'))}`, '');
    }
  }
  await writeFile(new URL('../docs/summary-quality-samples.md', import.meta.url), report.join('\n'));
  console.log('Saved docs/summary-quality-samples.md for semantic review.');
}
