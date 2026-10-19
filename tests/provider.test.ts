import { describe, expect, it, vi } from 'vitest';
import { createOpenAIProvider, summaryOutputBudget } from '../src/server/provider';
import { lengthTargets } from '../src/shared/summary';
import { summaryInstructions } from '../src/server/prompt';
import { fixtureSource } from '../src/dev/fixtures';

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
  for (const level of result.levels.slice(1)) {
    const cues = level.runs.filter(run => run.emphasis).map(run => run.text);
    expect(cues).toContain('may ease anxiety');
    expect(cues).toContain('need larger studies');
  }
});

it('caps sparse-highlight repair at two attempts', async () => {
  parse.mockClear();
  parse.mockResolvedValue({ status: 'completed', output_parsed: { compositions: [{
    lead: { subject: [{ text: 'The trial ', role: 'plain' }], details: [], predicate: { before: [], takeaway: 'may ease anxiety', after: [{ text: '.', role: 'plain' }] } },
    tail: [{ appearsAt: 1, before: [], takeaway: 'of the', after: [{ text: ' researchers plan to study many more participants over several months before making any recommendation.', role: 'plain' }], cueRole: 'supporting' }],
  }] } });
  await expect(createOpenAIProvider('test-key').summarize({ ...request, text: fixtureSource }, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'invalid_summary' } });
  expect(parse).toHaveBeenCalledTimes(2);
});
