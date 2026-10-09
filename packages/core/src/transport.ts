import {
  TeavenNetworkError,
  TeavenTimeoutError,
  TeavenError,
  fromResponse,
  parseRetryAfter,
} from './errors.js';
import type { ApiEnvelope } from './types.js';
import { DEFAULT_RETRY, computeDelay, shouldRetry, sleep } from './retry.js';
import type { RetryOptions } from './retry.js';

/** Minimal logging surface; `console` satisfies it. */
export interface Logger {
  debug?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
}

export interface RequestInfo {
  method: string;
  url: string;
  attempt: number;
}

export interface ResponseInfo {
  method: string;
  url: string;
  status: number;
  durationMs: number;
}

export interface TransportOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  retry: RetryOptions;
  fetchImpl: typeof globalThis.fetch;
  logger?: Logger;
  onRequest?: (info: RequestInfo) => void;
  onResponse?: (info: ResponseInfo) => void;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Path below `baseUrl`, e.g. `/v1/mail/send`. */
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /**
   * Whether the server treats a repeat as harmless.
   *
   * Sends are `false`: without an idempotency key a retry would deliver twice.
   */
  idempotent: boolean;
  signal?: AbortSignal;
}

/** Redact a credential so it can never reach a log sink intact. */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 6) return 'sk_***';
  return `${apiKey.slice(0, 6)}***`;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Combine the caller's signal with our timeout into one controller. */
function withTimeout(
  timeoutMs: number,
  external?: AbortSignal,
): { signal: AbortSignal; dispose: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = (): void => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    },
  };
}

/** HTTP layer: URL building, timeout, retry, envelope unwrapping, error mapping. */
export class Transport {
  private readonly options: TransportOptions;

  constructor(options: TransportOptions) {
    this.options = options;
  }

  /** Perform a request and return the unwrapped `data` payload. */
  async request<T>(options: RequestOptions): Promise<T> {
    const { retry, timeoutMs } = this.options;
    const maxAttempts = options.idempotent ? Math.max(1, retry.maxAttempts) : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.attempt<T>(options, attempt);
      } catch (error) {
        lastError = error;
        if (!shouldRetry(error, attempt, maxAttempts, options.idempotent)) throw error;
        const delay = computeDelay(attempt, retry);
        this.options.logger?.debug?.('teaven-email-sdk: retrying request', {
          attempt,
          delay,
          path: options.path,
        });
        await sleep(delay, options.signal);
      }
    }
    throw lastError instanceof Error ? lastError : new TeavenError({
      code: 'unknown_error',
      message: 'Request failed',
    });
  }

  private async attempt<T>(options: RequestOptions, attempt: number): Promise<T> {
    const url = buildUrl(this.options.baseUrl, options.path, options.query);
    const { signal, dispose, timedOut } = withTimeout(this.options.timeoutMs, options.signal);
    const startedAt = Date.now();

    this.options.onRequest?.({ method: options.method, url, attempt });

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.apiKey}`,
      Accept: 'application/json',
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const init: RequestInit = {
      method: options.method,
      headers,
      signal,
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);

    let response: Response;
    try {
      response = await this.options.fetchImpl(url, init);
    } catch (error) {
      if (timedOut()) {
        throw new TeavenTimeoutError(`Request timed out after ${this.options.timeoutMs}ms`, {
          cause: error,
        });
      }
      if (options.signal?.aborted) {
        throw new TeavenTimeoutError('Request aborted by caller', { cause: error });
      }
      throw new TeavenNetworkError(
        error instanceof Error ? error.message : 'Network request failed',
        { cause: error },
      );
    } finally {
      dispose();
    }

    const durationMs = Date.now() - startedAt;
    this.options.onResponse?.({
      method: options.method,
      url,
      status: response.status,
      durationMs,
    });

    const envelope = await this.parseEnvelope(response);
    const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));

    if (!response.ok || envelope.success === false) {
      throw fromResponse(response.status, envelope, retryAfterMs);
    }

    return envelope.data as T;
  }

  private async parseEnvelope(response: Response): Promise<ApiEnvelope<unknown>> {
    const text = await response.text();
    if (!text) return { success: response.ok };
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as ApiEnvelope<unknown>;
      return { success: response.ok, data: parsed };
    } catch {
      return { success: false, error: text.slice(0, 500) };
    }
  }
}
