import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BASE_URL, TeavenEmail, fromEnv } from '../src/client.js';
import { TeavenConfigError } from '../src/errors.js';
import { jsonFetch, stubFetch } from './helpers.js';

const KEY = 'sk_' + 'a'.repeat(64);

describe('constructor validation', () => {
  it('requires an apiKey', () => {
    // @ts-expect-error deliberately invalid input
    expect(() => new TeavenEmail({})).toThrow(TeavenConfigError);
  });

  it('rejects a key without the sk_ prefix', () => {
    expect(() => new TeavenEmail({ apiKey: 'nope' })).toThrow(/must start with "sk_"/);
  });

  it('rejects a malformed baseUrl', () => {
    expect(() => new TeavenEmail({ apiKey: KEY, baseUrl: 'not a url' })).toThrow(/Invalid baseUrl/);
  });

  it('rejects a non-http baseUrl', () => {
    expect(() => new TeavenEmail({ apiKey: KEY, baseUrl: 'ftp://example.com' })).toThrow(
      /must be http\(s\)/,
    );
  });

  it('rejects a non-positive timeout', () => {
    expect(() => new TeavenEmail({ apiKey: KEY, timeoutMs: 0 })).toThrow(/positive number/);
  });

  it('applies defaults without performing any I/O', () => {
    const fetchSpy = vi.fn();
    const client = new TeavenEmail({ apiKey: KEY, fetch: fetchSpy as unknown as typeof fetch });
    expect(client.options.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(client.options.timeoutMs).toBe(15_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('pins the production default host', () => {
    // Hard-coded on purpose: a self-referential assertion against DEFAULT_BASE_URL
    // would happily pass if the constant were changed by accident.
    expect(DEFAULT_BASE_URL).toBe('https://email.chenyande.com');
  });

  it('normalises a trailing slash on baseUrl', () => {
    const client = new TeavenEmail({ apiKey: KEY, baseUrl: 'https://example.com/' });
    expect(client.options.baseUrl).toBe('https://example.com');
  });
});

describe('fromEnv', () => {
  it('throws when the key is absent', () => {
    expect(() => fromEnv({})).toThrow(/TEAVEN_EMAIL_API_KEY is not set/);
  });

  it('reads the key and optional base url', () => {
    const client = fromEnv({
      TEAVEN_EMAIL_API_KEY: KEY,
      TEAVEN_EMAIL_BASE_URL: 'https://staging.example.com',
    });
    expect(client.options.baseUrl).toBe('https://staging.example.com');
  });
});

describe('withOptions', () => {
  it('derives a client that inherits unset options', () => {
    const client = new TeavenEmail({ apiKey: KEY, baseUrl: 'https://a.example.com' });
    const derived = client.withOptions({ timeoutMs: 1_000 });
    expect(derived.options.baseUrl).toBe('https://a.example.com');
    expect(derived.options.timeoutMs).toBe(1_000);
    expect(derived).not.toBe(client);
  });
});

describe('request plumbing', () => {
  it('sends a bearer token and returns the unwrapped data', async () => {
    const { fetch, calls } = jsonFetch({
      success: true,
      data: { mail_id: 'm1', queue_id: 'q1', status: 'queued', to: 'a@b.com' },
    });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    const result = await client.mail.send({ to: 'a@b.com', subject: 'hi', text: 'body' });

    expect(result.mailId).toBe('m1');
    expect(result.queueId).toBe('q1');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${DEFAULT_BASE_URL}/v1/mail/send`);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${KEY}`);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('never retries a send, even on a retryable server error', async () => {
    const { fetch, calls } = stubFetch([
      () => new Response(JSON.stringify({ success: false, error: 'boom' }), { status: 500 }),
      () => new Response(JSON.stringify({ success: false, error: 'boom' }), { status: 500 }),
    ]);
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await expect(client.mail.send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('fires the request and response hooks with timing', async () => {
    const onRequest = vi.fn();
    const onResponse = vi.fn();
    const { fetch } = jsonFetch({
      success: true,
      data: { mail_id: 'm', queue_id: 'q', status: 'queued', to: 'a@b.com' },
    });
    const client = new TeavenEmail({ apiKey: KEY, fetch, onRequest, onResponse });
    await client.mail.send({ to: 'a@b.com', subject: 's', text: 't' });

    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', attempt: 1 }),
    );
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 200, durationMs: expect.any(Number) }),
    );
  });

  it('surfaces a server error through the mapped error class', async () => {
    const { fetch } = jsonFetch({ success: false, error: 'Insufficient permissions' }, 403);
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await expect(client.mail.send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toThrow(
      /Insufficient permissions/,
    );
  });
});
