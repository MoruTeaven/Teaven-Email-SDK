import { describe, expect, it, vi } from 'vitest';
import { TeavenEmail } from '../src/client.js';
import {
  TeavenNetworkError,
  TeavenServerError,
  TeavenTimeoutError,
} from '../src/errors.js';
import { stubFetch } from './helpers.js';

const KEY = 'sk_' + 'c'.repeat(64);

describe('timeout', () => {
  it('aborts and reports a timeout error', async () => {
    const never = (async (_input: unknown, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as typeof globalThis.fetch;

    const client = new TeavenEmail({ apiKey: KEY, fetch: never, timeoutMs: 47 });
    await expect(client.mail.send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toBeInstanceOf(
      TeavenTimeoutError,
    );
  });
});

describe('network failure', () => {
  it('wraps a fetch rejection in TeavenNetworkError', async () => {
    const boom = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof globalThis.fetch;

    const client = new TeavenEmail({ apiKey: KEY, fetch: boom });
    await expect(client.mail.send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toBeInstanceOf(
      TeavenNetworkError,
    );
  });
});

describe('envelope parsing', () => {
  it('treats a non-JSON body as a server error instead of crashing', async () => {
    const { fetch } = stubFetch([
      () => new Response('<html>gateway</html>', { status: 502 }),
    ]);
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await expect(client.mail.send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toBeInstanceOf(
      TeavenServerError,
    );
  });

  it('honours success:false on a 200 response', async () => {
    const { fetch } = stubFetch([
      () => new Response(JSON.stringify({ success: false, error: 'nope' }), { status: 200 }),
    ]);
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await expect(client.mail.send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toThrow('nope');
  });
});

describe('retry behaviour on idempotent requests', () => {
  it('retries a retryable failure until it succeeds', async () => {
    const { fetch, calls } = stubFetch([
      () => new Response(JSON.stringify({ success: false, error: 'flaky' }), { status: 503 }),
      () =>
        new Response(
          JSON.stringify({ success: true, data: { ok: true } }),
          { status: 200 },
        ),
    ]);
    const client = new TeavenEmail({
      apiKey: KEY,
      fetch,
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
    });
    const result = await client.request<{ ok: boolean }>({
      method: 'GET',
      path: '/v1/mail/stats',
      idempotent: true,
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('stops after maxAttempts', async () => {
    const alwaysFails = (async () =>
      new Response(JSON.stringify({ success: false, error: 'down' }), { status: 500 })) as typeof fetch;
    const client = new TeavenEmail({
      apiKey: KEY,
      fetch: alwaysFails,
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    });
    await expect(
      client.request({ method: 'GET', path: '/v1/mail/stats', idempotent: true }),
    ).rejects.toBeInstanceOf(TeavenServerError);
  });

  it('does not retry a non-retryable status', async () => {
    const spy = vi.fn(
      async () => new Response(JSON.stringify({ success: false, error: 'bad key' }), { status: 401 }),
    );
    const client = new TeavenEmail({ apiKey: KEY, fetch: spy as unknown as typeof fetch });
    await expect(
      client.request({ method: 'GET', path: '/v1/mail/stats', idempotent: true }),
    ).rejects.toThrow('bad key');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
