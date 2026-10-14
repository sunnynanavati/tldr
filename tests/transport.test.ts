import { describe, expect, it, vi } from 'vitest';
import { createSummarizer } from '../src/extension/transport';
import { fixtureSource } from '../src/dev/fixtures';

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
});
