import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import { SummaryRequestSchema, validateSummary, wordCount, MAX_INPUT_CHARS } from '../shared/summary';
import { ServiceError, serviceError } from './errors';
import type { SummaryProvider } from './provider';

export interface ServerConfig {
  token: string; extensionId: string; provider: SummaryProvider | null;
  deadlineMs?: number; rateLimit?: number; concurrency?: number;
}
export function createApp(config: ServerConfig) {
  const app = Fastify({ logger: false, bodyLimit: MAX_INPUT_CHARS * 4 + 1024 });
  const origin = `chrome-extension://${config.extensionId}`;
  const expectedToken = Buffer.from(`Bearer ${config.token}`);
  const requests = new Map<string, AbortController>();
  let attempts: number[] = [];
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    // Chrome may omit Origin on privileged extension fetches. In that case require
    // the configured extension ID as well as the bearer token; reject all foreign web Origins.
    const declaredOrigin = request.headers.origin;
    const allowed = declaredOrigin === origin || (declaredOrigin === undefined && request.headers['x-tldr-extension-id'] === config.extensionId);
    if (!allowed) throw serviceError(403, 'origin', 'This extension is not connected to TLDR.', false);
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-TLDR-Extension-Id');
      return reply.code(204).send();
    }
    const token = Buffer.from(request.headers.authorization ?? '');
    if (token.length !== expectedToken.length || !timingSafeEqual(token, expectedToken)) {
      throw serviceError(401, 'connection', 'Connect TLDR in the extension settings.', false);
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    const failure = error instanceof ServiceError ? error : serviceError(
      (error as { statusCode?: number }).statusCode === 413 ? 413 : 400,
      'invalid_request', 'Select a shorter, readable passage and try again.', false,
    );
    return reply.code(failure.status).send({ error: failure.detail });
  });
  app.get('/health', async () => ({ ready: Boolean(config.provider) }));
  app.post('/v1/summaries', async (request, reply) => {
    const parsed = SummaryRequestSchema.safeParse(request.body);
    if (!parsed.success) throw serviceError(400, 'selection', 'Select a passage of up to 40,000 characters.', false);
    const input = parsed.data;
    if (wordCount(input.text) < 4) throw serviceError(422, 'too_short', 'Select a complete sentence or a longer passage.', false);
    if (!config.provider) throw serviceError(503, 'setup', 'Add your OpenAI API key to the local backend, then restart it.', false);
    const now = Date.now();
    attempts = attempts.filter(time => now - time < 60_000);
    if (attempts.length >= (config.rateLimit ?? 10)) throw serviceError(429, 'rate_limit', 'Give TLDR a moment, then try again.');
    if (requests.size >= (config.concurrency ?? 2)) throw serviceError(429, 'busy', 'TLDR is finishing another summary. Try again in a moment.');
    if (requests.has(input.requestId)) throw serviceError(409, 'duplicate', 'This summary is already being prepared.');
    attempts.push(now);
    const controller = new AbortController();
    requests.set(input.requestId, controller);
    let deadlineExpired = false;
    const onClose = () => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.on('close', onClose);
    let timeout: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        deadlineExpired = true; controller.abort();
        reject(serviceError(504, 'timeout', 'The summary took too long. Try again.'));
      }, config.deadlineMs ?? 20_000);
    });
    try {
      const model = await Promise.race([config.provider.summarize(input, controller.signal), deadline]);
      if (controller.signal.aborted) throw serviceError(499, 'cancelled', 'Summary cancelled.', false);
      if (model.segments.length === 0) throw serviceError(422, 'already_concise', 'This selection is already concise. Try selecting a longer passage.', false);
      try { return validateSummary(input, model); }
      catch { throw serviceError(502, 'invalid_summary', 'The summary needs another attempt. Try again.'); }
    } catch (error) {
      if (deadlineExpired) throw serviceError(504, 'timeout', 'The summary took too long. Try again.');
      if (error instanceof ServiceError) throw error;
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) throw serviceError(503, 'api_key', 'Check the OpenAI API key and access in your backend settings.', false);
      if (status === 429) throw serviceError(429, 'provider_limit', 'OpenAI is at its usage limit. Check API billing or try again later.');
      throw serviceError(502, 'provider', 'Could not reach the summary service. Try again.');
    } finally {
      clearTimeout(timeout!); reply.raw.off('close', onClose); requests.delete(input.requestId);
    }
  });
  app.addHook('onClose', async () => { for (const controller of requests.values()) controller.abort(); });
  return app;
}
