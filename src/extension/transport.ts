import { EXTENSION_TIMEOUT_MS, ReplySchema } from '../shared/protocol';
import { SummaryFailure, type Summarize } from '../shared/session';
import type { SummaryRequest } from '../shared/summary';

type Message = { type: 'summarize'; request: SummaryRequest } | { type: 'cancel'; requestId: string };
export function createSummarizer(send: (message: Message) => Promise<unknown>, timeoutMs = EXTENSION_TIMEOUT_MS): Summarize {
  return async (request, signal) => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const cancel = () => { void send({ type: 'cancel', requestId: request.requestId }).catch(() => undefined); };
    let onAbort!: () => void;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interrupted = new Promise<never>((_, reject) => {
      onAbort = () => { cancel(); reject(new DOMException('Aborted', 'AbortError')); };
      signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        cancel(); reject(new SummaryFailure({ code: 'timeout', message: 'The summary took too long. Try again.', retryable: true }));
      }, timeoutMs);
    });
    try {
      const raw = await Promise.race([send({ type: 'summarize', request }), interrupted]);
      const reply = ReplySchema.safeParse(raw);
      if (!reply.success) throw new SummaryFailure({ code: 'invalid_summary', message: 'The summary response was incomplete. Try again.', retryable: true });
      if (!reply.data.ok) throw new SummaryFailure(reply.data.error);
      return reply.data.result;
    } catch (error) {
      if (signal.aborted || error instanceof SummaryFailure) throw error;
      throw new SummaryFailure({ code: 'connection', message: 'TLDR was disconnected. Try again, or reload this page if the extension was updated.', retryable: true });
    } finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
  };
}
