import { mkdir, writeFile } from 'node:fs/promises';
import { createOpenAIProvider } from '../src/server/provider';
import { articleSections } from '../src/server/article';
import { MAX_INPUT_CHARS, validateSummary, levelText, wordCount } from '../src/shared/summary';
import { LONG_ARTICLE_DEADLINE_MS } from '../src/shared/protocol';
import { highlightSummary, type AnnotatedSummary } from '../src/server/emphasis';

// Original synthetic boundary/coverage probe. This is not a benchmark of all
// real articles: early context, a middle negative result, and a late reversal
// must survive a long body of plausible but lower-priority supporting detail.
const opening = `The River County service-renewal review examined a proposed forty-eight-million-dollar programme. That figure was a spending ceiling for discussion, not approved expenditure. Mira Sen chaired the independent review. The initial proposal would replace ageing assets across the county; later findings and the final decision in this report supersede those preliminary options. The committee compared repair, replacement, and continued monitoring rather than assuming that every project should proceed.\n\n`;
const middle = `CRITICAL MIDPOINT FINDING. Arun Das reported that the water-treatment pilot failed its safety test: treated samples still exceeded the contamination threshold. The pilot did not demonstrate safe drinking water and was not approved for household use. A second test was required before any expansion could be considered. This negative result was independent of whether the equipment met its delivery schedule.\n\n`;
const ending = `FINAL DECISION AFTER THE REVIEW. The council cancelled the county-wide rollout after the safety failures and unresolved costs. It approved only two small repair pilots: the North library roof and the East footbridge railing. No expansion of the water-treatment pilot was authorized. The forty-eight-million-dollar ceiling remains an unapproved proposal, not a spending commitment. Mira Sen said the county must publish independent safety results and a revised cost assessment before reconsidering expansion. The two repair pilots do not establish that the wider programme is safe, effective, or affordable. This final decision replaces the earlier rollout options described in the report.`;
const topics = ['library access', 'footbridge maintenance', 'bus shelters', 'drainage', 'school kitchens', 'archive storage', 'clinic waiting rooms', 'public lighting', 'recycling facilities', 'walking routes', 'water infrastructure', 'community gardens'];
const paragraphs = [opening];
let length = opening.length, index = 0, inserted = false;
while (length < MAX_INPUT_CHARS - ending.length - 2500) {
  if (!inserted && length >= MAX_INPUT_CHARS / 2) { paragraphs.push(middle); length += middle.length; inserted = true; }
  const topic = topics[index % topics.length]!;
  const paragraph = `Supporting inspection record ${++index}: ${topic}. The local team compared conditions at ${3 + index % 9} sites, recorded access restrictions, and asked staff to identify periods when repair work would cause the least disruption. These records are planning observations, not evidence that a replacement has already been purchased or installed. The report separates a contractor's estimated delivery window from the date a facility can safely reopen. A specialist must sign the inspection record before reopening; a paid invoice alone cannot substitute for that sign-off.\n\nThe ${topic} team proposed retaining the existing service where temporary arrangements were feasible. Where access would be restricted, residents would receive advance notice and a contact for alternative arrangements. Inspectors listed the condition of fittings, the availability of replacement parts, and the time needed to complete a supervised test. Some suppliers offered a lower initial price but excluded routine maintenance, so the committee asked for a comparable estimate covering the same period. The committee did not endorse the cheapest initial quote without reviewing these exclusions.\n\nFor record ${index}, the next review should distinguish completed repairs from work merely scheduled. Photographs can document a defect but do not by themselves establish its underlying cause. The local team requested an independent assessment where the cause remained uncertain. Resident comments would be considered alongside inspection evidence, and any change in scope would need an updated notice. None of these supporting records authorizes expenditure or overrides the programme's final decision. This record remains part of the audit trail even if the county decides against expansion.\n\n`;
  paragraphs.push(paragraph); length += paragraph.length;
}
const text = paragraphs.join('') + ending;
if (text.length > MAX_INPUT_CHARS || text.length < 190_000) throw new Error('Invalid long-article fixture size.');

if (!process.env.OPENAI_API_KEY) console.log('SKIPPED: OPENAI_API_KEY is not configured.');
else {
  const started = performance.now();
  let lastPlan: AnnotatedSummary | undefined;
  try {
    const request = { requestId: crypto.randomUUID(), text };
    const result = validateSummary(request, await createOpenAIProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL, plan => { lastPlan = plan; }, undefined, process.env.OPENAI_LONG_MODEL)
      .summarize(request, AbortSignal.timeout(LONG_ARTICLE_DEADLINE_MS)));
    const detailed = levelText(result.levels.at(-1)!);
    const checks = {
      earlyBudget: /forty.eight.million|48\s*million|48m/iu.test(detailed),
      middleNegativeResult: /(?:fail|unsafe|contaminat|did not demonstrate safe)/iu.test(detailed),
      lateReversal: /cancel|abandon|halt/iu.test(detailed),
      twoPilots: /two|2/u.test(detailed) && /pilot/iu.test(detailed),
    };
    const report = {
      sourceChars: text.length, sourceWords: wordCount(text), sections: articleSections(text).length,
      seconds: Number(((performance.now() - started) / 1000).toFixed(1)), wordCounts: result.wordCounts, checks,
      note: 'Synthetic coverage probe; keyword checks require manual review and do not establish factual fidelity on arbitrary articles.',
      levels: result.levels,
    };
    await writeFile('docs/long-article-smoke.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ...report, levels: undefined }));
    if (Object.values(checks).some(value => !value)) process.exitCode = 1;
  } catch (error) {
    let highlightFailure: string | undefined;
    if (lastPlan) {
      try { highlightSummary(lastPlan); } catch (failure) { highlightFailure = failure instanceof Error ? failure.message : 'Invalid highlights'; }
      // Preserve source-run identity for local reproduction of highlight bugs.
      // This diagnostic uses only the authored fixture and is ignored by Git.
      const runs = [...new Set(lastPlan.levels.flatMap(level => level.runs))];
      await mkdir('.runtime', { recursive: true });
      await writeFile('.runtime/long-article-plan.json', JSON.stringify({ runs, levels: lastPlan.levels.map(level => level.runs.map(run => runs.indexOf(run))) }));
    }
    console.error(JSON.stringify({ sourceChars: text.length, seconds: Number(((performance.now() - started) / 1000).toFixed(1)), error: error instanceof Error ? error.name : 'Provider failure',
      // Only this authored fixture runner exposes a bounded diagnostic. The
      // production request path continues to return safe errors without logs.
      diagnostic: error instanceof Error ? error.stack?.slice(0, 700) : undefined, highlightFailure }));
    process.exitCode = 1;
  }
}
