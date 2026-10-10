import { describe, expect, it } from 'vitest';
import { TeavenEmail } from '../src/client.js';
import { jsonFetch } from './helpers.js';

const KEY = 'sk_' + 'a'.repeat(64);

describe('mail resource — logs & stats', () => {
  it('listLogs passes limit/offset as query', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: [] });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.mail.listLogs({ limit: 10, offset: 20 });
    expect(calls[0]!.url).toContain('/v1/mail/logs?limit=10&offset=20');
  });

  it('getStats passes days as query', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: [] });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.mail.getStats(7);
    expect(calls[0]!.url).toContain('/v1/mail/stats?days=7');
  });

  it('getLog hits the right path', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: { id: 'm1' } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.mail.getLog('m1');
    expect(calls[0]!.url).toBe('https://mail.moruteaven.com/v1/mail/logs/m1');
  });
});

describe('verification resource', () => {
  it('send maps sceneType to scene_type', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: { mail_id: 'm', queue_id: 'q', status: 'queued', scene_type: 'login', to: 'a@b.com', expires_in: 600 } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.verification.send({ template: 'CODE', to: 'a@b.com', sceneType: 'login', codeLength: 6, expireMinutes: 10 });
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.scene_type).toBe('login');
    expect(body.code_length).toBe(6);
    expect(body.expire_minutes).toBe(10);
  });

  it('verify maps sceneType to scene_type', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: { valid: true, message: 'ok' } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    const result = await client.verification.verify({ email: 'a@b.com', code: '123456', sceneType: 'login' });
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.scene_type).toBe('login');
    expect(result.valid).toBe(true);
  });
});
