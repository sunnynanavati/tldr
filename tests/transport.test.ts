import { describe, expect, it, vi } from 'vitest';
import { createSummarizer } from '../src/extension/transport';
import { fixtureSource, fixtureResult } from '../src/dev/fixtures';
import { LONG_ARTICLE_CHARS } from '../src/shared/summary';
import { LONG_ARTICLE_TIMEOUT_MS } from '../src/shared/protocol';

const request = () => ({ requestId: crypto.randomUUID(), text: fixtureSource });
describe('extension request transport', () => {
  it('reports service-worker interruption as a retryable connection error', async () => {
    const summarize = createSummarizer(async () => { throw new Error('The message port closed.'); });
    await expect(summarize(request(), new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'connection', retryable: true } });
  });
  it('rejects malformed replies without rendering them', async () => {
    const summarize = createSummarizer(async () => ({ ok: true, result: { text: 'invalid response' } }));
    await expect(summarize(request(), new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'invalid_summary' } });
  });
  it('cancels a timed-out worker request', async () => {
    const send = vi.fn(async () => new Promise(() => {}));
    const input = request(), summarize = createSummarizer(send, 10);
    await expect(summarize(input, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'timeout' } });
    expect(send).toHaveBeenLastCalledWith({ type: 'cancel', requestId: input.requestId });
  });
  it('settles immediately on close even if the worker never answers', async () => {
    const send = vi.fn(async () => new Promise(() => {}));
    const input = request(), controller = new AbortController();
    const pending = createSummarizer(send)(input, controller.signal); controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(send).toHaveBeenLastCalledWith({ type: 'cancel', requestId: input.requestId });
  });
  it('polls long jobs through separate messages and returns the matching result', async () => {
    const input = request(), result = fixtureResult(input);
    const send = vi.fn().mockResolvedValueOnce({ pending: true, requestId: input.requestId })
      .mockResolvedValueOnce({ pending: true, requestId: input.requestId }).mockResolvedValueOnce({ ok: true, result });
    expect(await createSummarizer(send, 1000, 1)(input, new AbortController().signal)).toEqual(result);
    expect(send.mock.calls.slice(1).map(call => call[0])).toEqual(Array(2).fill({ type: 'poll', requestId: input.requestId }));
  });
  it('cancels polling immediately when the tray closes', async () => {
    const input = request(), controller = new AbortController();
    const send = vi.fn<(message: { type: string }) => Promise<unknown>>(async () => ({ pending: true, requestId: input.requestId }));
    const pending = createSummarizer(send, 1000, 5)(input, controller.signal);
    await new Promise(resolve => setTimeout(resolve, 1)); controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ type: 'cancel', requestId: input.requestId });
  });
  it('rejects a stale job identity before polling', async () => {
    const send = vi.fn(async () => ({ pending: true, requestId: crypto.randomUUID() }));
    await expect(createSummarizer(send)(request(), new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'invalid_summary' } });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

it('keeps long jobs alive past the old timeout and cancels at the new bound', async () => {
  vi.useFakeTimers();
  try {
    const input = { ...request(), text: 'Evidence. '.repeat(Math.ceil((LONG_ARTICLE_CHARS + 1) / 10)) };
    const send = vi.fn<(message: { type: string }) => Promise<unknown>>(async () => ({ pending: true, requestId: input.requestId }));
    const pending = createSummarizer(send)(input, new AbortController().signal);
    const rejected = expect(pending).rejects.toMatchObject({ detail: { code: 'timeout' } });
    await vi.advanceTimersByTimeAsync(100_000);
    expect(send.mock.calls.some(([message]) => message?.type === 'cancel')).toBe(false);
    await vi.advanceTimersByTimeAsync(LONG_ARTICLE_TIMEOUT_MS - 100_000);
    await rejected;
    expect(send).toHaveBeenLastCalledWith({ type: 'cancel', requestId: input.requestId });
  } finally { vi.useRealTimers(); }
});
