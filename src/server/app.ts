import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import { SummaryRequestSchema, validateSummary, wordCount, MAX_INPUT_CHARS, LONG_ARTICLE_CHARS, INPUT_LIMIT_MESSAGE, type SummaryRequest } from '../shared/summary';
import { LONG_ARTICLE_DEADLINE_MS, type SummaryReply } from '../shared/protocol';
import { ServiceError, serviceError } from './errors';
import type { SummaryProvider } from './provider';

export interface ServerConfig {
  token: string; extensionId: string; provider: SummaryProvider | null;
  deadlineMs?: number; jobLeaseMs?: number; rateLimit?: number; concurrency?: number;
}
export function createApp(config: ServerConfig) {
  // JSON can escape one UTF-16 code unit into six bytes (e.g. control characters).
  const app = Fastify({ logger: false, bodyLimit: MAX_INPUT_CHARS * 6 + 1024 });
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
      reply.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
  function admit(body: unknown): { input: SummaryRequest; controller: AbortController } {
    const parsed = SummaryRequestSchema.safeParse(body);
    if (!parsed.success) throw serviceError(400, 'selection', INPUT_LIMIT_MESSAGE, false);
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
    return { input, controller };
  }
  async function generate(input: SummaryRequest, controller: AbortController, duration = 20_000) {
    let deadlineExpired = false;
    let onAbort!: () => void;
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(serviceError(499, 'cancelled', 'Summary cancelled.', false));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    let timeout: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        deadlineExpired = true; controller.abort();
        reject(serviceError(504, 'timeout', 'The summary took too long. Try again.'));
      }, config.deadlineMs ?? duration);
    });
    try {
      const model = await Promise.race([config.provider!.summarize(input, controller.signal), deadline, cancelled]);
      if (controller.signal.aborted) throw serviceError(499, 'cancelled', 'Summary cancelled.', false);
      if (model.levels.length === 0) throw serviceError(422, 'already_concise', 'This selection is already concise. Try selecting a longer passage.', false);
      try { return validateSummary(input, model); }
      catch { throw serviceError(502, 'invalid_summary', 'The summary needs another attempt. Try again.'); }
    } catch (error) {
      if (deadlineExpired) throw serviceError(504, 'timeout', 'The summary took too long. Try again.');
      if (error instanceof ServiceError) throw error;
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) throw serviceError(503, 'api_key', 'Check the OpenAI API key and access in your backend settings.', false);
      if (status === 429) throw serviceError(429, 'provider_limit', 'OpenAI is at its usage limit. Check API billing or try again later.');
      throw serviceError(502, 'provider', 'The summary could not be prepared. Try again.');
    } finally {
      clearTimeout(timeout!); controller.signal.removeEventListener('abort', onAbort); requests.delete(input.requestId);
    }
  }
  app.post('/v1/summaries', async (request, reply) => {
    const parsed = SummaryRequestSchema.safeParse(request.body);
    if (parsed.success && parsed.data.text.length > LONG_ARTICLE_CHARS) {
      throw serviceError(400, 'use_job', 'Long articles require a background summary job. Reload the TLDR extension and try again.', false);
    }
    const { input, controller } = admit(request.body);
    const onClose = () => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.on('close', onClose);
    try { return await generate(input, controller); }
    finally { reply.raw.off('close', onClose); }
  });

  // Long articles use short HTTP exchanges. A polling lease bounds orphaned work
  // if the tab disappears or Chrome restarts the worker between requests.
  type Job = { controller: AbortController; touched: number; reply?: SummaryReply };
  const jobs = new Map<string, Job>();
  const lease = config.jobLeaseMs ?? 30_000;
  const reap = setInterval(() => {
    for (const [id, job] of jobs) if (Date.now() - job.touched > lease) {
      job.controller.abort(); jobs.delete(id);
    }
  }, Math.min(1000, lease));
  reap.unref();
  app.post('/v1/summary-jobs', async (request, reply) => {
    if (jobs.size >= 20) throw serviceError(429, 'busy', 'TLDR is finishing another summary. Try again in a moment.');
    const parsed = SummaryRequestSchema.safeParse(request.body);
    if (parsed.success && jobs.has(parsed.data.requestId)) throw serviceError(409, 'duplicate', 'This summary is already being prepared.');
    const { input, controller } = admit(request.body);
    const job: Job = { controller, touched: Date.now() }; jobs.set(input.requestId, job);
    void generate(input, controller, input.text.length > LONG_ARTICLE_CHARS ? LONG_ARTICLE_DEADLINE_MS : 90_000).then(result => {
      if (jobs.get(input.requestId) === job) job.reply = { ok: true, result };
    }, error => {
      if (jobs.get(input.requestId) === job) job.reply = { ok: false, error: error instanceof ServiceError ? error.detail : { code: 'provider', message: 'The summary could not be prepared. Try again.', retryable: true } };
    });
    return reply.code(202).send({ pending: true, requestId: input.requestId });
  });
  app.get<{ Params: { id: string } }>('/v1/summary-jobs/:id', async (request, reply) => {
    const job = jobs.get(request.params.id);
    if (!job) throw serviceError(404, 'expired', 'The summary session expired. Try again.');
    job.touched = Date.now();
    if (!job.reply) return reply.code(202).send({ pending: true, requestId: request.params.id });
    // Keep the result until acknowledged by DELETE, allowing a lost poll to retry.
    return job.reply;
  });
  app.delete<{ Params: { id: string } }>('/v1/summary-jobs/:id', async (request, reply) => {
    jobs.get(request.params.id)?.controller.abort(); jobs.delete(request.params.id);
    return reply.code(204).send();
  });
  app.addHook('onClose', async () => {
    clearInterval(reap); jobs.clear();
    for (const controller of requests.values()) controller.abort();
  });
  return app;
}
