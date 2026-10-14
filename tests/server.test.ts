import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type ServerConfig } from '../src/server/app';
import { fixtureSource, fixtureLevels, shortSource, shortLevels } from '../src/dev/fixtures';
import { serviceError } from '../src/server/errors';
import type { SummaryProvider } from '../src/server/provider';

const extensionId = 'a'.repeat(32), token = 'test-only-local-token-'.repeat(3);
const headers = { origin: `chrome-extension://${extensionId}`, authorization: `Bearer ${token}` };
const payload = (text = fixtureSource) => ({ requestId: crypto.randomUUID(), text });
const apps: ReturnType<typeof createApp>[] = [];
function setup(provider: SummaryProvider | null = { summarize: async () => ({ levels: fixtureLevels }) }, extra: Partial<ServerConfig> = {}) {
  const app = createApp({ token, extensionId, provider, ...extra }); apps.push(app); return app;
}
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
describe('local backend', () => {
  it('requires the configured origin and token on both endpoints', async () => {
    const app = setup();
    for (const url of ['/health', '/v1/summaries']) {
      const method = url === '/health' ? 'GET' : 'POST';
      expect((await app.inject({ method, url, headers: { ...headers, origin: 'https://example.com' } })).statusCode).toBe(403);
      expect((await app.inject({ method, url, headers: { origin: headers.origin } })).statusCode).toBe(401);
    }
    const response = await app.inject({ method: 'OPTIONS', url: '/v1/summaries', headers: { origin: headers.origin } });
    expect(response.statusCode).toBe(204); expect(response.headers['access-control-allow-origin']).toBe(headers.origin);
  });
  it('returns complete-level counts and reflects only the matching request ID', async () => {
    const app = setup(), input = payload();
    const response = await app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: input });
    expect(response.statusCode).toBe(200); expect(response.json().requestId).toBe(input.requestId);
    expect(response.json().wordCounts).toEqual([20, 35, 50, 80, 110]); expect(response.headers['cache-control']).toBe('no-store');
  });
  it('accepts Chrome’s omitted Origin only with the configured extension ID and bearer token', async () => {
    const app = setup();
    const extensionHeaders = { authorization: headers.authorization, 'x-tldr-extension-id': extensionId };
    expect((await app.inject({ url: '/health', headers: extensionHeaders })).statusCode).toBe(200);
    expect((await app.inject({ url: '/health', headers: { authorization: headers.authorization } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/health', headers: { ...extensionHeaders, origin: 'https://example.com' } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/health', headers: { 'x-tldr-extension-id': extensionId } })).statusCode).toBe(401);
  });
  it('serves a compact summary for short selections', async () => {
    const app = setup({ summarize: async () => ({ levels: shortLevels }) });
    const response = await app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload(shortSource) });
    expect(response.statusCode).toBe(200); expect(response.json().levels).toHaveLength(1);
  });
  it('explains when meaningful shortening is impossible', async () => {
    const app = setup({ summarize: async () => ({ levels: [] }) });
    const response = await app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload('The meeting starts at noon.') });
    expect(response.statusCode).toBe(422); expect(response.json().error.code).toBe('already_concise');
    expect(response.json().error.retryable).toBe(false);
  });
  it('returns actionable setup and selection errors before calling a provider', async () => {
    const app = setup(null);
    expect((await app.inject({ method: 'GET', url: '/health', headers })).json()).toEqual({ ready: false });
    expect((await app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload() })).json().error.code).toBe('setup');
    expect((await app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload('hello') })).json().error.code).toBe('too_short');
    expect((await app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload('x'.repeat(40_001)) })).statusCode).toBe(400);
  });
  it('rejects invalid model output without exposing its contents', async () => {
    const app = setup({ summarize: async () => ({ levels: [{ runs: [{ text: 'private provider content', emphasis: false }] }] }) });
    const response = await app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload() });
    expect(response.statusCode).toBe(502); expect(response.body).not.toContain('private provider content');
  });
  it('aborts a slow provider and bounds request duration', async () => {
    let signal: AbortSignal | undefined;
    const app = setup({ summarize: async (_request, incoming) => { signal = incoming; return new Promise(() => {}); } }, { deadlineMs: 20 });
    const response = await app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload() });
    expect(response.statusCode).toBe(504); expect(signal?.aborted).toBe(true);
  });
  it('limits concurrent requests and request rate', async () => {
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const app = setup({ summarize: async () => { entered(); return new Promise(() => {}); } }, { deadlineMs: 50, concurrency: 1 });
    const first = app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload() }).then(response => response);
    await started;
    const second = await app.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload() });
    expect(second.statusCode).toBe(429); await first;
    const rateApp = setup(undefined, { rateLimit: 1 });
    await rateApp.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload() });
    expect((await rateApp.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload() })).statusCode).toBe(429);
  });
  it('maps provider refusals and failures to safe public errors', async () => {
    const refused = setup({ summarize: async () => { throw serviceError(422, 'refused', 'Try a different passage.', false); } });
    expect((await refused.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload() })).json().error.retryable).toBe(false);
    const failed = setup({ summarize: async () => { throw new Error('secret-key-private-debug-text'); } });
    const response = await failed.inject({ method: 'POST', url: '/v1/summaries', headers, payload: payload() });
    expect(response.statusCode).toBe(502); expect(response.body).not.toContain('secret');
  });
});
