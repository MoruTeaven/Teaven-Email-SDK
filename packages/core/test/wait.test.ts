import { describe, expect, it, vi } from 'vitest';
import { TeavenEmail } from '../src/client.js';
import { TeavenConfigError, TeavenTimeoutError } from '../src/errors.js';
import { jsonFetch, stubFetch } from './helpers.js';

const KEY = 'sk_' + 'a'.repeat(64);

function logResponse(status: string): () => Response {
  return () =>
    new Response(JSON.stringify({ success: true, data: { id: 'm1', status } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
}

describe('waitForDelivery', () => {
  it('returns immediately when the message already settled', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: { id: 'm1', status: 'sent' } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    const log = await client.mail.waitForDelivery('m1', { intervalMs: 1 });
    expect(log.status).toBe('sent');
    expect(calls).toHaveLength(1);
  });

  it('polls until the status leaves pending', async () => {
    const { fetch, calls } = stubFetch([
      logResponse('pending'),
      logResponse('pending'),
      logResponse('sent'),
    ]);
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    const log = await client.mail.waitForDelivery('m1', { intervalMs: 1 });
    expect(log.status).toBe('sent');
    expect(calls).toHaveLength(3);
  });

  it('treats failed as terminal too', async () => {
    const { fetch, calls } = stubFetch([logResponse('pending'), logResponse('failed')]);
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    const log = await client.mail.waitForDelivery('m1', { intervalMs: 1 });
    expect(log.status).toBe('failed');
    expect(calls).toHaveLength(2);
  });

  it('throws TeavenTimeoutError when it never settles', async () => {
    const { fetch } = stubFetch([logResponse('pending')]);
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await expect(
      client.mail.waitForDelivery('m1', { timeoutMs: 5, intervalMs: 2 }),
    ).rejects.toBeInstanceOf(TeavenTimeoutError);
  });

  it('rejects a non-positive timeout or interval', async () => {
    const { fetch } = jsonFetch({ success: true, data: { id: 'm1', status: 'sent' } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await expect(client.mail.waitForDelivery('m1', { timeoutMs: 0 })).rejects.toBeInstanceOf(
      TeavenConfigError,
    );
    await expect(client.mail.waitForDelivery('m1', { intervalMs: -1 })).rejects.toBeInstanceOf(
      TeavenConfigError,
    );
  });

  it('honours an already-aborted signal', async () => {
    const { fetch } = stubFetch([logResponse('pending')]);
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    const controller = new AbortController();
    controller.abort();
    await expect(
      client.mail.waitForDelivery('m1', { intervalMs: 1, signal: controller.signal }),
    ).rejects.toThrow(/Aborted/);
  });

  it('does not retry the poll on a forbidden response', async () => {
    const { fetch, calls } = stubFetch([
      () =>
        new Response(JSON.stringify({ success: false, error: 'insufficient permission' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
    ]);
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await expect(client.mail.waitForDelivery('m1', { intervalMs: 1 })).rejects.toThrow(
      /insufficient permission/,
    );
    // 403 is not retryable: exactly one attempt.
    expect(calls).toHaveLength(1);
  });
});
