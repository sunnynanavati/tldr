import { z } from 'zod';
import { SummaryRequestSchema, SummaryResponseSchema } from './summary';

export const BACKEND_URL = 'http://127.0.0.1:4317';
export const EXTENSION_TIMEOUT_MS = 25_000;
export const ErrorSchema = z.object({ code: z.string(), message: z.string(), retryable: z.boolean() });
export type PublicError = z.infer<typeof ErrorSchema>;
export const ReplySchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), result: SummaryResponseSchema }),
  z.object({ ok: z.literal(false), error: ErrorSchema }),
]);
export type SummaryReply = z.infer<typeof ReplySchema>;
export const ControllerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('open'), request: SummaryRequestSchema }),
  z.object({ type: z.literal('selection-error'), error: ErrorSchema }),
]);
export const WorkerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('summarize'), request: SummaryRequestSchema }),
  z.object({ type: z.literal('cancel'), requestId: z.string().uuid() }),
  z.object({ type: z.literal('settings') }),
]);
