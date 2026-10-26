import { describe, expect, it, vi } from 'vitest';
import { createOpenAIProvider, summaryOutputBudget } from '../src/server/provider';
import { lengthTargets } from '../src/shared/summary';
import { summaryInstructions } from '../src/server/prompt';
import { fixtureSource } from '../src/dev/fixtures';
import { articleSections } from '../src/server/article';
import { APIConnectionError } from 'openai/error';

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { parse }; } }));
const request = { requestId: 'test-request', text: 'A useful meeting ends with a written decision and a named owner.' };

it('scales the provider budget and prompt with article targets', () => {
  expect(summaryOutputBudget(lengthTargets(200))).toBe(4000);
  expect(summaryOutputBudget(lengthTargets(10000))).toBe(12400);
  expect(summaryInstructions(10000)).toContain('60, 140, 300, 550, 800 words');
  expect(summaryInstructions(10000)).toContain('ceil(actual word count / 12)');
});

describe('provider output failures', () => {
  it('classifies unusable generated highlights as invalid output, not connectivity', async () => {
    parse.mockResolvedValueOnce({ status: 'completed', output_parsed: {
      levels: [{ runs: [{ text: 'Write decisions and assign owners.', emphasis: false }] }],
      highlights: [{ phrases: ['absent private generated phrase'] }],
    } });
    await expect(createOpenAIProvider('test-key').summarize(request, new AbortController().signal))
      .rejects.toMatchObject({ status: 502, detail: { code: 'invalid_summary', retryable: true, message: 'The summary needs another attempt. Try again.' } });
  });
  it('preserves provider errors for authentication and rate-limit handling', async () => {
    const failure = Object.assign(new Error('private provider details'), { status: 429 });
    parse.mockRejectedValueOnce(failure);
    await expect(createOpenAIProvider('test-key').summarize(request, new AbortController().signal)).rejects.toBe(failure);
  });
});


it('repairs sparse expanded highlights once while preserving existing cues', async () => {
  const response = (cue: string) => ({ status: 'completed', output_parsed: { compositions: [{
    lead: { subject: [{ text: 'The trial ', role: 'plain' }], details: [{ appearsAt: 1, runs: [{ text: ', conducted locally, ', role: 'plain' }] }], predicate: { before: [], takeaway: 'may ease anxiety', after: [{ text: '.', role: 'plain' }] } },
    tail: [{ appearsAt: 1, before: [{ text: ' Researchers ', role: 'plain' }], takeaway: cue, after: [{ text: ' before they can recommend the exercise as a replacement for established care.', role: 'plain' }], cueRole: 'supporting' }],
  }] } });
  parse.mockClear();
  parse.mockResolvedValueOnce(response('need the')).mockResolvedValueOnce(response('need larger studies'));
  const result = await createOpenAIProvider('test-key').summarize({ ...request, text: fixtureSource }, new AbortController().signal);
  expect(parse).toHaveBeenCalledTimes(2);
  expect(JSON.parse(parse.mock.calls[1]![0].input[0].content).reviewFeedback).toContain('Level 1 introduces');
  for (const level of result.levels.slice(1)) {
    const cues = level.runs.filter(run => run.emphasis).map(run => run.text);
    expect(cues).toContain('may ease anxiety');
    expect(cues).toContain('need larger studies');
  }
});

it('caps sparse-highlight repair at two attempts', async () => {
  parse.mockClear();
  parse.mockResolvedValue({ status: 'completed', output_parsed: { compositions: [{
    lead: { subject: [{ text: 'The trial ', role: 'plain' }], details: [{ appearsAt: 1, runs: [{ text: ', conducted locally,', role: 'plain' }] }], predicate: { before: [], takeaway: 'may ease anxiety', after: [{ text: '.', role: 'plain' }] } },
    tail: [{ appearsAt: 1, before: [], takeaway: 'of the', after: [{ text: ' researchers plan to study many more participants over several months before making any recommendation.', role: 'plain' }], cueRole: 'supporting' }],
  }] } });
  await expect(createOpenAIProvider('test-key').summarize({ ...request, text: fixtureSource }, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'invalid_summary' } });
  expect(parse).toHaveBeenCalledTimes(2);
});

it('reads every long-article section, retries one transient failure, then synthesizes with the full source and ordered evidence', async () => {
  parse.mockReset();
  let connectionFailed = false;
  const text = 'The trial did not establish a cure. Researchers need more evidence. '.repeat(800);
  parse.mockImplementation(async options => {
    if (options.text.format.name === 'tldr_article_review') return { status: 'completed', output_parsed: { acceptable: true, feedback: '' } };
    if (options.text.format.name === 'tldr_section_evidence') {
      if (!connectionFailed) { connectionFailed = true; throw new APIConnectionError({ cause: new Error('test transport failure') }); }
      return { status: 'completed', output_parsed: { excerpts: [{ start: 1, end: 1, kind: 'qualification' }] } };
    }
    return { status: 'completed', output_parsed: { compositions: [{
      lead: { subject: [{ text: 'The trial ', role: 'plain' }], details: [{ appearsAt: 1, runs: [{ text: ', conducted locally,', role: 'plain' }] }], predicate: [{ text: ' did not establish a cure', role: 'takeaway' }, { text: ' despite continued research.', role: 'plain' }] }, tail: [],
    }] } };
  });
  const result = await createOpenAIProvider('test-key').summarize({ ...request, text }, new AbortController().signal);
  expect(result.levels).toHaveLength(5);
  expect(parse).toHaveBeenCalledTimes(articleSections(text).length + 3);
  const final = parse.mock.calls.at(-2)![0];
  const input = JSON.parse(final.input[0].content);
  expect(input.originalSource).toBe(text);
  expect(input.sectionEvidence.map((section: { section: number }) => section.section)).toEqual(articleSections(text).map(section => section.index + 1));
  expect(final.instructions).toContain('later corrections');
  expect(final.store).toBe(false);
  expect(final.reasoning).toEqual({ effort: 'low' });
  expect(final.model).toBe('gpt-6-sol');
  expect(parse.mock.calls[0]![0].model).toBe('gpt-6-luna');
  expect(parse.mock.calls[0]![0].reasoning).toEqual({ effort: 'none' });
  expect(JSON.parse(parse.mock.calls.at(-1)![0].input[0].content).originalSource).toBe(text);
});

it.each([true, false])('uses one bounded quality correction and never skips a rejected review (second review passes: %s)', async accepted => {
  parse.mockReset();
  const text = 'The trial did not establish a cure. Researchers need more evidence. '.repeat(800);
  let reviews = 0;
  parse.mockImplementation(async options => {
    if (options.text.format.name === 'tldr_section_evidence') return { status: 'completed', output_parsed: { excerpts: [{ start: 0, end: 0, kind: 'qualification' }] } };
    if (options.text.format.name === 'tldr_article_review') return { status: 'completed', output_parsed: { acceptable: ++reviews > 1 && accepted, feedback: 'Remove the repeated claim and correct the missing verb in level 2.' } };
    return { status: 'completed', output_parsed: { compositions: [{
      lead: { subject: [{ text: 'The trial ', role: 'plain' }], details: [{ appearsAt: 1, runs: [{ text: ', conducted locally,', role: 'plain' }] }], predicate: [{ text: ' did not establish a cure', role: 'takeaway' }, { text: ' despite continued research.', role: 'plain' }] }, tail: [],
    }] } };
  });
  const result = createOpenAIProvider('test-key').summarize({ ...request, text }, new AbortController().signal);
  if (accepted) expect((await result).levels).toHaveLength(5);
  else await expect(result).rejects.toMatchObject({ detail: { code: 'invalid_summary' } });
  expect(parse).toHaveBeenCalledTimes(articleSections(text).length + 4);
  const drafts = parse.mock.calls.filter(([options]) => options.text.format.name === 'tldr_article_composition');
  expect(drafts).toHaveLength(2);
  expect(JSON.parse(drafts[1]![0].input[0].content).reviewFeedback).toContain('missing verb');
  expect(JSON.parse(drafts[1]![0].input[0].content).previousDraft.compositions).toHaveLength(1);
});

it('never creates a final summary from incomplete or fabricated section evidence', async () => {
  parse.mockReset();
  parse.mockResolvedValue({ status: 'completed', output_parsed: { excerpts: [{ start: 9999, end: 9999, kind: 'finding' }] } });
  await expect(createOpenAIProvider('test-key').summarize({ ...request, text: 'The trial did not establish a cure. '.repeat(1600) }, new AbortController().signal))
    .rejects.toMatchObject({ detail: { code: 'invalid_evidence' } });
  expect(parse.mock.calls.every(([options]) => options.text.format.name === 'tldr_section_evidence')).toBe(true);
});
