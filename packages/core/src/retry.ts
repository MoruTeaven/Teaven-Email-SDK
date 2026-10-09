import { TeavenError } from './errors.js';

export interface RetryOptions {
  /** Total attempts, including the first one. `1` disables retrying. */
  maxAttempts: number;
  /** Delay before the first retry; doubles each attempt. */
  baseDelayMs: number;
  /** Upper bound for a single backoff delay. */
  maxDelayMs: number;
}

/** Defaults tuned for an idempotent read against a Worker. */
export const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 377,
  maxDelayMs: 5_777,
};

/** Exponential backoff with +/-20% jitter, clamped to `maxDelayMs`. */
export function computeDelay(attempt: number, options: RetryOptions): number {
  const exponential = options.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const jittered = exponential * (0.8 + Math.random() * 0.4);
  // Clamp after jitter: jitter must never push a delay past the configured ceiling.
  return Math.max(0, Math.round(Math.min(jittered, options.maxDelayMs)));
}

/**
 * Decide whether another attempt is allowed.
 *
 * Non-idempotent requests (the send endpoints) are never retried: the server has
 * no idempotency key, so a retry would deliver the message twice.
 */
export function shouldRetry(
  error: unknown,
  attempt: number,
  maxAttempts: number,
  idempotent: boolean,
): boolean {
  if (!idempotent) return false;
  if (attempt >= maxAttempts) return false;
  if (!(error instanceof TeavenError)) return false;
  return error.retryable;
}

/** `setTimeout` that rejects as soon as `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
