import { TeavenConfigError } from './errors.js';
import { DEFAULT_RETRY } from './retry.js';
import type { RetryOptions } from './retry.js';
import { Transport } from './transport.js';
import type { Logger, RequestOptions } from './transport.js';
import { MailResource } from './resources/mail.js';
import { VerificationResource } from './resources/verification.js';

/** Default API host. */
export const DEFAULT_BASE_URL = 'https://email.chenyande.com';

export interface TeavenEmailOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  retry?: Partial<RetryOptions>;
  fetch?: typeof globalThis.fetch;
  logger?: Logger;
  onRequest?: (info: { method: string; url: string; attempt: number }) => void;
  onResponse?: (info: {
    method: string;
    url: string;
    status: number;
    durationMs: number;
  }) => void;
  allowBrowser?: boolean;
}

function isBrowserLike(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function resolveFetch(injected?: typeof globalThis.fetch): typeof globalThis.fetch {
  const impl = injected ?? globalThis.fetch;
  if (typeof impl !== 'function') {
    throw new TeavenConfigError(
      'No fetch implementation available. Pass options.fetch on runtimes without a global fetch.',
    );
  }
  return impl;
}

function normaliseBaseUrl(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new TeavenConfigError(`Invalid baseUrl: ${baseUrl}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TeavenConfigError(`baseUrl must be http(s), received ${parsed.protocol}`);
  }
  return parsed.toString().replace(/\/$/, '');
}

export class TeavenEmail {
  /** Mail sending and delivery-tracking operations. */
  readonly mail: MailResource;
  /** Verification code send and verify. */
  readonly verification: VerificationResource;

  readonly options: {
    baseUrl: string;
    timeoutMs: number;
    retry: RetryOptions;
  };

  private readonly transport: Transport;
  private readonly original: TeavenEmailOptions;

  constructor(options: TeavenEmailOptions) {
    if (!options || typeof options !== 'object') {
      throw new TeavenConfigError('Options object is required');
    }
    if (typeof options.apiKey !== 'string' || options.apiKey.length === 0) {
      throw new TeavenConfigError('apiKey is required');
    }
    if (!options.apiKey.startsWith('sk_')) {
      throw new TeavenConfigError('apiKey must start with "sk_"');
    }
    if (isBrowserLike() && options.allowBrowser !== true) {
      throw new TeavenConfigError(
        'Refusing to run in a browser without allowBrowser: true. ' +
          'An API key embedded in client-side code is public.',
      );
    }

    const baseUrl = normaliseBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    const timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new TeavenConfigError('timeoutMs must be a positive number');
    }
    const retry: RetryOptions = { ...DEFAULT_RETRY, ...options.retry };

    this.original = options;
    this.options = { baseUrl, timeoutMs, retry };
    this.transport = new Transport({
      baseUrl,
      apiKey: options.apiKey,
      timeoutMs,
      retry,
      fetchImpl: resolveFetch(options.fetch),
      ...(options.logger ? { logger: options.logger } : {}),
      ...(options.onRequest ? { onRequest: options.onRequest } : {}),
      ...(options.onResponse ? { onResponse: options.onResponse } : {}),
    });

    this.mail = new MailResource((request) => this.transport.request(request));
    this.verification = new VerificationResource((request) => this.transport.request(request));
  }

  withOptions(overrides: Partial<TeavenEmailOptions>): TeavenEmail {
    return new TeavenEmail({ ...this.original, ...overrides });
  }

  request<T>(options: RequestOptions): Promise<T> {
    return this.transport.request<T>(options);
  }
}

export function fromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): TeavenEmail {
  const apiKey = env['TEAVEN_EMAIL_API_KEY'];
  if (!apiKey) {
    throw new TeavenConfigError('TEAVEN_EMAIL_API_KEY is not set');
  }
  const baseUrl = env['TEAVEN_EMAIL_BASE_URL'];
  return new TeavenEmail({ apiKey, ...(baseUrl ? { baseUrl } : {}) });
}
