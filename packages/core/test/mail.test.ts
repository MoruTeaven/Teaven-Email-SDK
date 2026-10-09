import { describe, expect, it } from 'vitest';
import { TeavenEmail } from '../src/client.js';
import { bodyOf, jsonFetch, stubFetch } from './helpers.js';

const KEY = 'sk_' + 'b'.repeat(64);

function client(responses: Parameters<typeof stubFetch>[0]) {
  const stub = stubFetch(responses);
  return { client: new TeavenEmail({ apiKey: KEY, fetch: stub.fetch }), calls: stub.calls };
}

describe('mail.send', () => {
  it('posts the exact request body the server expects', async () => {
    const { client: c, calls } = client([
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { mail_id: 'm1', queue_id: 'q1', status: 'queued', to: 'x@y.com' },
          }),
          { status: 200 },
        ),
    ]);

    await c.mail.send({
      to: 'x@y.com',
      subject: 'Hello',
      html: '<p>hi</p>',
      category: 'NOTIFY',
    });

    expect(bodyOf(calls[0]!)).toEqual({
      to: 'x@y.com',
      subject: 'Hello',
      html: '<p>hi</p>',
      category: 'NOTIFY',
    });
  });

  it('omits template from the normalised result', async () => {
    const { client: c } = client([
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { mail_id: 'm', queue_id: 'q', status: 'queued', to: 'x@y.com' },
          }),
          { status: 200 },
        ),
    ]);
    const result = await c.mail.send({ to: 'x@y.com', subject: 's', text: 't' });
    expect(result.template).toBeUndefined();
    expect('template' in result).toBe(false);
  });
});

describe('mail.sendTemplate', () => {
  it('posts to the template endpoint and echoes the template code', async () => {
    const { client: c, calls } = client([
      () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              mail_id: 'm2',
              queue_id: 'q2',
              status: 'queued',
              to: 'x@y.com',
              template: 'VERIFY_CODE',
            },
          }),
          { status: 200 },
        ),
    ]);

    const result = await c.mail.sendTemplate({
      template: 'VERIFY_CODE',
      to: 'x@y.com',
      variables: { code: '123456' },
    });

    expect(calls[0]!.url).toMatch(/\/v1\/mail\/send-template$/);
    expect(bodyOf(calls[0]!)).toEqual({
      template: 'VERIFY_CODE',
      to: 'x@y.com',
      variables: { code: '123456' },
    });
    expect(result.template).toBe('VERIFY_CODE');
  });

  it('maps a missing-variable 400 to a validation error', async () => {
    const { fetch } = jsonFetch(
      { success: false, error: 'Missing variables: code' },
      400,
    );
    const c = new TeavenEmail({ apiKey: KEY, fetch });
    await expect(
      c.mail.sendTemplate({ template: 'T', to: 'x@y.com', variables: {} }),
    ).rejects.toThrow(/Missing variables: code/);
  });
});
