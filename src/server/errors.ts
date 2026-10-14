import type { PublicError } from '../shared/protocol';
export class ServiceError extends Error {
  constructor(public status: number, public detail: PublicError) { super(detail.message); }
}
export const serviceError = (status: number, code: string, message: string, retryable = true): ServiceError =>
  new ServiceError(status, { code, message, retryable });
