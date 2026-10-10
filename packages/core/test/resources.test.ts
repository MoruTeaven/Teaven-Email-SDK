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
    expect(calls[0]!.url).toBe('https://email.chenyande.com/v1/mail/logs/m1');
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

describe('templates resource', () => {
  it('lists templates at GET /v1/templates', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: [] });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.templates.list();
    expect(calls[0]!.init.method).toBe('GET');
    expect(calls[0]!.url).toBe('https://email.chenyande.com/v1/templates');
  });

  it('creates a template with textContent mapped to text_content', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: { id: 't1', template_code: 'c1' } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.templates.create({ name: 'Welcome', subject: 'Hi', html: '<p>Hi</p>', textContent: 'Hi' });
    expect(calls[0]!.init.method).toBe('POST');
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.text_content).toBe('Hi');
    expect(body.name).toBe('Welcome');
  });

  it('updates a template with enabled mapped to 1/0', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: {} });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.templates.update('c1', { enabled: false });
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.enabled).toBe(0);
  });

  it('deletes a template at the right path', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: { message: 'deleted' } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.templates.delete('c1');
    expect(calls[0]!.init.method).toBe('DELETE');
    expect(calls[0]!.url).toBe('https://email.chenyande.com/v1/templates/c1');
  });

  it('previews at the right path', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: {} });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.templates.preview('c1', { name: 'World' });
    expect(calls[0]!.url).toBe('https://email.chenyande.com/v1/templates/c1/preview');
  });

  it('gets versions at the right path', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: [] });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.templates.versions('c1');
    expect(calls[0]!.url).toBe('https://email.chenyande.com/v1/templates/c1/versions');
  });
});
