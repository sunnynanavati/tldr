import { writeFile } from 'node:fs/promises';
import { createOpenAIProvider } from '../src/server/provider';
import { lengthTargets, validateSummary, wordCount, type ModelSummary, type SummaryRequest } from '../src/shared/summary';

// Original synthetic report: public-style test data, not a user's selected article.
const projects = [
  ['Riverside bridge', 'reinforce cracked supports', 'twelve million dollars', 'independent structural inspection', 'the existing bridge stays open', 'December'],
  ['North library', 'extend evening opening hours', 'six additional librarians', 'recruitment and training', 'weekend hours remain unchanged', 'September'],
  ['East bus corridor', 'introduce dedicated bus lanes', 'four kilometres of roadway', 'traffic signal testing', 'emergency vehicles retain access', 'November'],
  ['Harbor flood barrier', 'replace worn gate mechanisms', 'eight mechanical gates', 'coastal permit approval', 'temporary barriers protect the work area', 'October'],
  ['West school kitchens', 'replace outdated cooking equipment', 'nine school kitchens', 'electrical safety certification', 'temporary catering continues during installation', 'August'],
  ['Central water system', 'repair leaking supply pipes', 'eighteen kilometres of pipe', 'water quality testing', 'households receive advance outage notices', 'January'],
  ['Hilltop park', 'make walking routes accessible', 'three kilometres of paths', 'accessibility review with residents', 'mature trees will be preserved', 'April'],
  ['South recycling depot', 'expand material sorting capacity', 'two sorting lines', 'equipment delivery', 'existing collection schedules remain in place', 'March'],
  ['Lakeside clinic', 'add community appointment rooms', 'five consultation rooms', 'staffing agreements', 'emergency care remains at the regional hospital', 'February'],
  ['Old town housing', 'insulate council-owned apartments', 'two hundred apartments', 'tenant scheduling agreements', 'residents will not be required to move out', 'May'],
  ['Market square', 'improve drainage and lighting', 'forty new lights', 'utility surveys', 'traders receive temporary alternative pitches', 'June'],
  ['Station bicycle hub', 'provide secure bicycle storage', 'three hundred bicycle spaces', 'rail operator permission', 'pedestrian routes stay open during construction', 'July'],
  ['Valley sports centre', 'replace the damaged roof', 'one indoor sports hall', 'final contractor selection', 'outdoor facilities remain available', 'October'],
  ['Museum archive', 'upgrade humidity controls', 'four archive rooms', 'conservation specialist approval', 'fragile objects move into temporary storage', 'November'],
  ['Community garden network', 'install rainwater storage', 'twenty storage tanks', 'ground stability checks', 'allotment holders keep access to their plots', 'March'],
  ['Civic records office', 'digitize planning records', 'fifty thousand paper records', 'privacy and accuracy checks', 'paper originals will be retained', 'December'],
] as const;
const text = `The city council has approved a coordinated public service renewal programme. Approval authorizes planning, but does not mean that individual projects have secured all permits or that their proposed completion dates are guaranteed. The programme concentrates on repairing existing assets and improving access rather than constructing a new civic headquarters. An independent committee will publish quarterly progress reports. Residents can inspect project budgets and submit questions through public meetings. The report below describes the separate projects and their constraints.\n\n` + projects.map(([name, purpose, scale, condition, continuity, month], i) => `${name} is intended to ${purpose}. The proposed scale is ${scale}, and the planning office has listed ${month} as the target completion month in the next annual work programme. Progress depends on ${condition}; the council has not said that this condition has already been met. During the work, ${continuity}. This project is listed as item ${i + 1} in the programme. Its responsible department must report delays and changes in scope at the next quarterly meeting. Officials described the schedule as provisional, so residents should check the published notice before making plans that depend on the new service. No estimate of the final operating savings has been approved. The committee will evaluate the outcome using completed work and access to services, rather than treating expenditure alone as evidence of success.`).join('\n\n');
async function throughBackend(request: SummaryRequest): Promise<ModelSummary> {
  const base = 'http://127.0.0.1:4317/v1/summary-jobs';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.TLDR_LOCAL_TOKEN}`, 'X-TLDR-Extension-Id': process.env.TLDR_EXTENSION_ID ?? '' };
  const signal = AbortSignal.timeout(95_000);
  try {
    let response = await fetch(base, { method: 'POST', headers, signal, body: JSON.stringify(request) });
    while (response.status === 202) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await fetch(`${base}/${request.requestId}`, { headers, signal });
    }
    const result = await response.json() as { ok: boolean; result?: ModelSummary; error?: { code: string } };
    if (!response.ok || !result.ok || !result.result) { const error = new Error('Backend summary failed'); error.name = `Backend_${result.error?.code ?? 'invalid_response'}`; throw error; }
    return result.result;
  } finally {
    await fetch(`${base}/${request.requestId}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(5000) }).catch(() => undefined);
  }
}
if (!process.env.OPENAI_API_KEY) {
  console.log('SKIPPED: OPENAI_API_KEY is not configured.');
} else {
  const request = { requestId: crypto.randomUUID(), text };
  const started = performance.now();
  try {
    const model = process.env.TLDR_SMOKE_HTTP === '1' ? await throughBackend(request) : await createOpenAIProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL).summarize(request, AbortSignal.timeout(Number(process.env.TLDR_SMOKE_TIMEOUT_MS ?? 90_000)));
    const result = validateSummary(request, model);
    const report = { transport: process.env.TLDR_SMOKE_HTTP === '1' ? 'authenticated background job' : 'direct provider', sourceWords: wordCount(text), targets: lengthTargets(wordCount(text)), actualWords: result.wordCounts, highlightPhrases: result.levels.map(level => level.runs.filter(run => run.emphasis).length), seconds: Number(((performance.now() - started) / 1000).toFixed(1)) };
    console.log(JSON.stringify(report));
    await writeFile('docs/adaptive-summary-smoke.json', JSON.stringify({ ...report, levels: result.levels }, null, 2) + '\n');
  } catch (error) {
    console.log(JSON.stringify({ sourceWords: wordCount(text), targets: lengthTargets(wordCount(text)), seconds: Number(((performance.now() - started) / 1000).toFixed(1)), error: error instanceof Error ? error.name : 'Provider failure' }));
    process.exitCode = 1;
  }
}
