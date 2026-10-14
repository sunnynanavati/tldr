import { createApp } from './app';
import { createOpenAIProvider } from './provider';

const token = process.env.TLDR_LOCAL_TOKEN ?? '';
const extensionId = process.env.TLDR_EXTENSION_ID ?? '';
if (token.length < 32 || !/^[a-p]{32}$/.test(extensionId)) {
  console.error('Set TLDR_LOCAL_TOKEN (at least 32 characters) and TLDR_EXTENSION_ID in .env. See README.md.');
  process.exitCode = 1;
} else {
  const key = process.env.OPENAI_API_KEY;
  const app = createApp({ token, extensionId, provider: key ? createOpenAIProvider(key, process.env.OPENAI_MODEL) : null });
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => { void app.close(); });
  await app.listen({ host: '127.0.0.1', port: 4317 });
  console.log(`TLDR listening on http://127.0.0.1:4317 · OpenAI ${key ? 'configured' : 'key needed'}`);
}
