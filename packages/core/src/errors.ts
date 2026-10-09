import type { ApiEnvelope } from './types.js';

/** Stable, programmatic error identifiers. */
export type TeavenErrorCode =
  | 'config_error'
  | 'validation_error'
  | 'auth_error'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'maintenance'
  | 'server_error'
  | 'network_error'
  | 'timeout'
  | 'unknown_error';

/** Extra fields shared by every Teaven error subclass. */
export interface TeavenErrorExtra {
  status?: number;
  serverMessage?: string;
  requestId?: string;
  cause?: unknown;
}

export interface TeavenErrorOptions extends TeavenErrorExtra {
  code: TeavenErrorCode;
  message: string;
  retryable?: boolean;
}

/**
 * Base class for every error the SDK throws.
 *
 * `code` is stable and safe to branch on; `message` never contains the API key.
 */
export class TeavenError extends Error {
  readonly code: TeavenErrorCode;
  readonly status: number | undefined;
  readonly serverMessage: string | undefined;
  readonly requestId: string | undefined;
  /** Whether the server described the failure as transient. */
  readonly retryable: boolean;

  constructor(options: TeavenErrorOptions) {
    super(options.message);
    this.name = 'TeavenError';
    this.code = options.code;
    this.status = options.status;
    this.serverMessage = options.serverMessage;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  /** Serializable form; safe to hand to a logger. */
  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    if (this.status !== undefined) out['status'] = this.status;
    if (this.serverMessage !== undefined) out['serverMessage'] = this.serverMessage;
    if (this.requestId !== undefined) out['requestId'] = this.requestId;
    return out;
  }
}

function opts(
  code: TeavenErrorCode,
  message: string,
  retryable: boolean,
  extra: TeavenErrorExtra = {},
): TeavenErrorOptions {
  const built: TeavenErrorOptions = { code, message, retryable };
  if (extra.status !== undefined) built.status = extra.status;
  if (extra.serverMessage !== undefined) built.serverMessage = extra.serverMessage;
  if (extra.requestId !== undefined) built.requestId = extra.requestId;
  if (extra.cause !== undefined) built.cause = extra.cause;
  return built;
}

/** Local misconfiguration: bad options, unsupported runtime, etc. */
export class TeavenConfigError extends TeavenError {
  constructor(message: string, extra?: TeavenErrorExtra) {
    super(opts('config_error', message, false, extra));
    this.name = 'TeavenConfigError';
  }
}

/** HTTP 400 — the request body was rejected. */
export class TeavenValidationError extends TeavenError {
  constructor(message: string, extra?: TeavenErrorExtra) {
    super(opts('validation_error', message, false, extra));
    this.name = 'TeavenValidationError';
  }
}

/** HTTP 401 — missing, invalid, expired or disabled credential. */
export class TeavenAuthError extends TeavenError {
  constructor(message: string, extra?: TeavenErrorExtra) {
    super(opts('auth_error', message, false, extra));
    this.name = 'TeavenAuthError';
  }
}

/** HTTP 403 — the credential lacks a required permission, or the account is inactive. */
export class TeavenForbiddenError extends TeavenError {
  constructor(message: string, extra?: TeavenErrorExtra) {
    super(opts('forbidden', message, false, extra));
    this.name = 'TeavenForbiddenError';
  }
}

/** HTTP 404 — the referenced resource does not exist for this user. */
export class TeavenNotFoundError extends TeavenError {
  constructor(message: string, extra?: TeavenErrorExtra) {
    super(opts('not_found', message, false, extra));
    this.name = 'TeavenNotFoundError';
  }
}

/**
 * HTTP 429 — daily quota or rate limit.
 *
 * `retryAfterMs` is populated once the server sends `Retry-After`; it is
 * `undefined` today because the server does not emit that header yet.
 */
export class TeavenRateLimitError extends TeavenError {
  readonly retryAfterMs: number | undefined;

  constructor(message: string, extra?: TeavenErrorExtra, retryAfterMs?: number) {
    super(opts('rate_limited', message, true, extra));
    this.name = 'TeavenRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** HTTP 503 with `error: "maintenance_mode"`. */
export class TeavenMaintenanceError extends TeavenError {
  constructor(message: string, extra?: TeavenErrorExtra) {
    super(opts('maintenance', message, false, extra));
    this.name = 'TeavenMaintenanceError';
  }
}

/** HTTP 5xx — server-side failure. */
export class TeavenServerError extends TeavenError {
  constructor(message: string, extra?: TeavenErrorExtra) {
    super(opts('server_error', message, true, extra));
    this.name = 'TeavenServerError';
  }
}

/** The request never produced an HTTP response (DNS, reset, offline, ...). */
export class TeavenNetworkError extends TeavenError {
  constructor(message: string, extra?: TeavenErrorExtra) {
    super(opts('network_error', message, true, extra));
    this.name = 'TeavenNetworkError';
  }
}

/** The request exceeded `timeoutMs`, or the caller's `AbortSignal` fired. */
export class TeavenTimeoutError extends TeavenError {
  constructor(message: string, extra?: TeavenErrorExtra) {
    super(opts('timeout', message, false, extra));
    this.name = 'TeavenTimeoutError';
  }
}

/**
 * Map an HTTP response onto the SDK error hierarchy.
 *
 * Mirrors the server's `{ success: false, error }` envelope and status codes.
 */
export function fromResponse(
  status: number,
  envelope: ApiEnvelope<unknown>,
  retryAfterMs?: number,
): TeavenError {
  const serverMessage = envelope.error;
  const message = serverMessage ?? `Request failed with status ${status}`;
  const extra: TeavenErrorExtra = { status };
  if (serverMessage !== undefined) extra.serverMessage = serverMessage;
  if (status === 400) return new TeavenValidationError(message, extra);
  if (status === 401) return new TeavenAuthError(message, extra);
  if (status === 403) return new TeavenForbiddenError(message, extra);
  if (status === 404) return new TeavenNotFoundError(message, extra);
  if (status === 429) return new TeavenRateLimitError(message, extra, retryAfterMs);
  if (status === 503 && serverMessage === 'maintenance_mode') {
    return new TeavenMaintenanceError(envelope.message ?? message, extra);
  }
  if (status >= 500) return new TeavenServerError(message, extra);
  return new TeavenError(opts('unknown_error', message, false, extra));
}

/** Parse `Retry-After` (seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}
