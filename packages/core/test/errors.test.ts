import { describe, expect, it } from 'vitest';
import {
  TeavenAuthError,
  TeavenForbiddenError,
  TeavenMaintenanceError,
  TeavenNotFoundError,
  TeavenRateLimitError,
  TeavenServerError,
  TeavenValidationError,
  TeavenError,
  fromResponse,
  parseRetryAfter,
} from '../src/errors.js';
import { maskApiKey } from '../src/transport.js';

describe('fromResponse', () => {
  it('maps 400 to a validation error carrying the server message', () => {
    const error = fromResponse(400, { success: false, error: 'to and subject are required' });
    expect(error).toBeInstanceOf(TeavenValidationError);
    expect(error.code).toBe('validation_error');
    expect(error.serverMessage).toBe('to and subject are required');
    expect(error.retryable).toBe(false);
  });

  it('maps 401 to an auth error', () => {
    const error = fromResponse(401, { success: false, error: 'Invalid or disabled API key' });
    expect(error).toBeInstanceOf(TeavenAuthError);
    expect(error.status).toBe(401);
    expect(error.retryable).toBe(false);
  });

  it('maps 403 to a forbidden error', () => {
    expect(fromResponse(403, { success: false, error: 'Insufficient permissions' })).toBeInstanceOf(
      TeavenForbiddenError,
    );
  });

  it('maps 404 to a not-found error', () => {
    expect(fromResponse(404, { success: false, error: "Template 'X' not found" })).toBeInstanceOf(
      TeavenNotFoundError,
    );
  });

  it('maps 429 to a retryable rate-limit error and keeps retryAfterMs', () => {
    const error = fromResponse(429, { success: false, error: 'Daily sending limit reached' }, 5_000);
    expect(error).toBeInstanceOf(TeavenRateLimitError);
    expect(error.retryable).toBe(true);
    expect((error as TeavenRateLimitError).retryAfterMs).toBe(5_000);
  });

  it('maps maintenance 503 to a non-retryable maintenance error', () => {
    const error = fromResponse(503, {
      success: false,
      error: 'maintenance_mode',
      message: 'Back at 03:00',
    });
    expect(error).toBeInstanceOf(TeavenMaintenanceError);
    expect(error.message).toBe('Back at 03:00');
    expect(error.retryable).toBe(false);
  });

  it('maps other 5xx to a retryable server error', () => {
    const error = fromResponse(500, { success: false, error: 'No enabled email provider found' });
    expect(error).toBeInstanceOf(TeavenServerError);
    expect(error.retryable).toBe(true);
  });

  it('falls back to unknown_error for unmapped statuses', () => {
    const error = fromResponse(418, { success: false, error: 'teapot' });
    expect(error).toBeInstanceOf(TeavenError);
    expect(error.code).toBe('unknown_error');
  });

  it('produces a serialisable error that never contains a key', () => {
    const error = fromResponse(401, { success: false, error: 'Invalid or disabled API key' });
    const json = error.toJSON();
    expect(json['code']).toBe('auth_error');
    expect(JSON.stringify(json)).not.toContain('sk_');
  });
});

describe('parseRetryAfter', () => {
  it('returns undefined for missing or unparsable values', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('not-a-date')).toBeUndefined();
  });

  it('converts seconds to milliseconds', () => {
    expect(parseRetryAfter('12')).toBe(12_000);
  });

  it('converts an HTTP date to a positive delta', () => {
    const future = new Date(Date.now() + 30_000).toUTCString();
    const value = parseRetryAfter(future);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(30_000);
  });
});

describe('maskApiKey', () => {
  it('keeps a short prefix and hides the rest', () => {
    expect(maskApiKey('sk_abcdef1234567890')).toBe('sk_abc***');
  });

  it('never leaks a short key', () => {
    expect(maskApiKey('sk_ab')).toBe('sk_***');
  });
});
