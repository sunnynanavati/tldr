import { ARTICLE_TIMEOUT_MS, EXTENSION_TIMEOUT_MS, LONG_ARTICLE_TIMEOUT_MS, JobReplySchema } from '../shared/protocol';
import { SummaryFailure, type Summarize } from '../shared/session';
import { lengthTargets, wordCount, LONG_ARTICLE_CHARS, type SummaryRequest } from '../shared/summary';

type Message = { type: 'summarize'; request: SummaryRequest } | { type: 'cancel' | 'poll'; requestId: string };
export function createSummarizer(send: (message: Message) => Promise<unknown>, timeoutMs?: number, pollMs = 1000): Summarize {
  return async (request, signal) => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    let stopped = false;
    const cancel = () => { stopped = true; void send({ type: 'cancel', requestId: request.requestId }).catch(() => undefined); };
    let onAbort!: () => void;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interrupted = new Promise<never>((_, reject) => {
      onAbort = () => { cancel(); reject(new DOMException('Aborted', 'AbortError')); };
      signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        cancel(); reject(new SummaryFailure({ code: 'timeout', message: 'The summary took too long. Try again.', retryable: true }));
      }, timeoutMs ?? (request.text.length > LONG_ARTICLE_CHARS ? LONG_ARTICLE_TIMEOUT_MS
        : lengthTargets(wordCount(request.text)).at(-1)! > 110 ? ARTICLE_TIMEOUT_MS : EXTENSION_TIMEOUT_MS));
    });
    try {
      let raw = await Promise.race([send({ type: 'summarize', request }), interrupted]);
      let reply = JobReplySchema.safeParse(raw);
      while (reply.success && 'pending' in reply.data) {
        if (reply.data.requestId !== request.requestId) throw new SummaryFailure({ code: 'invalid_summary', message: 'The summary response did not match. Try again.', retryable: true });
        await Promise.race([new Promise(resolve => setTimeout(resolve, pollMs)), interrupted]);
        if (stopped) throw new DOMException('Aborted', 'AbortError');
        raw = await Promise.race([send({ type: 'poll', requestId: request.requestId }), interrupted]);
        reply = JobReplySchema.safeParse(raw);
      }
      if (!reply.success) throw new SummaryFailure({ code: 'invalid_summary', message: 'The summary response was incomplete. Try again.', retryable: true });
      if ('pending' in reply.data) throw new Error('Unexpected pending reply');
      if (!reply.data.ok) throw new SummaryFailure(reply.data.error);
      return reply.data.result;
    } catch (error) {
      if (signal.aborted || error instanceof SummaryFailure) throw error;
      throw new SummaryFailure({ code: 'connection', message: 'TLDR was disconnected. Try again, or reload this page if the extension was updated.', retryable: true });
    } finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
  };
}
