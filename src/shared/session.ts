import { SummaryResponseSchema, type SummaryRequest, type SummaryResult } from './summary';
import type { PublicError } from './protocol';

export class SummaryFailure extends Error {
  constructor(public detail: PublicError) { super(detail.message); }
}
export type SummaryState =
  | { status: 'closed' }
  | { status: 'loading'; requestId: string }
  | { status: 'ready'; result: SummaryResult }
  | { status: 'error'; error: PublicError };
export type Summarize = (request: SummaryRequest, signal: AbortSignal) => Promise<SummaryResult>;
export class SummarySession {
  private controller: AbortController | null = null;
  private generation = 0;
  private request: SummaryRequest | null = null;
  constructor(private summarize: Summarize, private changed: (state: SummaryState) => void) {}
  async open(request: SummaryRequest): Promise<void> {
    this.controller?.abort(); const generation = ++this.generation;
    const controller = new AbortController(); this.controller = controller; this.request = request;
    this.changed({ status: 'loading', requestId: request.requestId });
    try {
      const result = SummaryResponseSchema.parse(await this.summarize(request, controller.signal));
      if (generation !== this.generation || controller.signal.aborted) return;
      if (result.requestId !== request.requestId) throw new Error('Response mismatch');
      this.changed({ status: 'ready', result });
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return;
      this.changed({ status: 'error', error: error instanceof SummaryFailure ? error.detail : {
        code: 'unexpected', message: 'The summary could not be loaded. Try again.', retryable: true,
      } });
    }
  }
  retry(): void { if (this.request) void this.open({ ...this.request, requestId: crypto.randomUUID() }); }
  close(): void { ++this.generation; this.controller?.abort(); this.controller = null; this.request = null; this.changed({ status: 'closed' }); }
}
