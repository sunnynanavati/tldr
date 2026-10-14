import { createApp } from '../src/server/app';
import { fixtureResult } from '../src/dev/fixtures';
import { serviceError } from '../src/server/errors';
const token = process.env.TLDR_LOCAL_TOKEN ?? '';
const extensionId = process.env.TLDR_EXTENSION_ID ?? '';
if (token.length < 32 || !/^[a-p]{32}$/.test(extensionId)) throw new Error('Configure TLDR_LOCAL_TOKEN and TLDR_EXTENSION_ID in .env first.');
const app = createApp({ token, extensionId, rateLimit: 100, provider: {
  async summarize(request, signal) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 1000);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true });
    });
    try { return { segments: fixtureResult(request).segments }; }
    catch { throw serviceError(422, 'fixture', 'Offline test: select one of the complete passages on the TLDR fixture page.', false); }
  },
} });
app.addHook('onResponse', async (request, reply) => {
  console.log(`${request.method} ${request.url} ${reply.statusCode} · origin: ${request.headers.origin ?? '(omitted)'}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
await app.listen({ host: '127.0.0.1', port: 4317 });
console.log('TLDR fixture backend on 127.0.0.1:4317 · authored test passages only · no AI calls');
