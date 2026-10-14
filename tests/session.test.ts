import { describe, expect, it, vi } from 'vitest';
import { SummarySession, SummaryFailure, type SummaryState } from '../src/shared/session';
import { fixtureResult, fixtureSource, shortSource } from '../src/dev/fixtures';
import type { SummaryResult } from '../src/shared/summary';

const request = (text = fixtureSource) => ({ requestId: crypto.randomUUID(), text });
describe('request lifecycle', () => {
  it('aborts replaced work and never renders its late result', async () => {
    const pending: { resolve: (value: SummaryResult) => void; signal: AbortSignal }[] = [];
    const states: SummaryState[] = [];
    const session = new SummarySession((_request, signal) => new Promise(resolve => pending.push({ resolve, signal })), state => states.push(state));
    const first = request(), second = request(shortSource);
    const a = session.open(first); const b = session.open(second);
    expect(pending[0]!.signal.aborted).toBe(true);
    pending[1]!.resolve(fixtureResult(second)); await b;
    pending[0]!.resolve(fixtureResult(first)); await a;
    expect(states.filter(state => state.status === 'ready')).toEqual([{ status: 'ready', result: fixtureResult(second) }]);
  });
  it('does not reopen after close, even if a provider ignores cancellation', async () => {
    let resolve!: (value: SummaryResult) => void;
    const changed = vi.fn(); const input = request();
    const session = new SummarySession(() => new Promise(done => { resolve = done; }), changed);
    const loading = session.open(input); session.close(); resolve(fixtureResult(input)); await loading;
    expect(changed.mock.calls.at(-1)![0]).toEqual({ status: 'closed' });
    expect(changed).toHaveBeenCalledTimes(2);
  });
  it('rejects a mismatched response and retries with a fresh request ID', async () => {
    const input = request(); const changed = vi.fn();
    const provider = vi.fn(async () => fixtureResult(request()));
    const session = new SummarySession(provider, changed);
    await session.open(input); expect(changed.mock.calls.at(-1)![0].status).toBe('error');
    session.retry(); await Promise.resolve();
    expect((provider.mock.calls as unknown as [typeof input][])[1]![0].requestId).not.toBe(input.requestId);
  });
  it('preserves safe, actionable backend errors', async () => {
    const changed = vi.fn(); const error = { code: 'setup', message: 'Configure your backend.', retryable: false };
    const session = new SummarySession(async () => { throw new SummaryFailure(error); }, changed);
    await session.open(request()); expect(changed.mock.calls.at(-1)![0]).toEqual({ status: 'error', error });
  });
});
