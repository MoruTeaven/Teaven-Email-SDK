import { describe, expect, it } from 'vitest';
import { DEFAULT_RETRY, computeDelay, shouldRetry } from '../src/retry.js';
import { TeavenAuthError, TeavenNetworkError, TeavenRateLimitError } from '../src/errors.js';

describe('computeDelay', () => {
  it('grows exponentially and stays within the jitter envelope', () => {
    const first = computeDelay(1, DEFAULT_RETRY);
    const second = computeDelay(2, DEFAULT_RETRY);
    expect(first).toBeGreaterThanOrEqual(DEFAULT_RETRY.baseDelayMs * 0.8);
    expect(first).toBeLessThanOrEqual(DEFAULT_RETRY.baseDelayMs * 1.2);
    expect(second).toBeGreaterThan(first * 0.9);
  });

  it('never exceeds maxDelayMs', () => {
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      expect(computeDelay(attempt, DEFAULT_RETRY)).toBeLessThanOrEqual(DEFAULT_RETRY.maxDelayMs);
    }
  });
});

describe('shouldRetry', () => {
  it('refuses to retry non-idempotent requests even on transient errors', () => {
    const error = new TeavenNetworkError('reset');
    expect(shouldRetry(error, 1, 3, false)).toBe(false);
  });

  it('retries retryable errors on idempotent requests', () => {
    expect(shouldRetry(new TeavenNetworkError('reset'), 1, 3, true)).toBe(true);
  });

  it('stops once attempts are exhausted', () => {
    expect(shouldRetry(new TeavenNetworkError('reset'), 3, 3, true)).toBe(false);
  });

  it('does not retry non-retryable errors', () => {
    expect(shouldRetry(new TeavenAuthError('bad key'), 1, 3, true)).toBe(false);
  });

  it('honours the retryable flag from the server', () => {
    expect(shouldRetry(new TeavenRateLimitError('slow down'), 1, 3, true)).toBe(true);
  });

  it('ignores values that are not SDK errors', () => {
    expect(shouldRetry(new Error('boom'), 1, 3, true)).toBe(false);
    expect(shouldRetry('boom', 1, 3, true)).toBe(false);
  });
});
