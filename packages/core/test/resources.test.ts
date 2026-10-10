import { describe, expect, it } from 'vitest';
import { TeavenEmail } from '../src/client.js';
import { jsonFetch, stubFetch } from './helpers.js';

const KEY = 'sk_' + 'a'.repeat(64);

describe('templates resource', () => {
  it('lists templates, optionally with category query', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: [] });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.templates.list();
    expect(calls[0]!.init.method).toBe('GET');
    expect(calls[0]!.url).toBe(`https://mail.moruteaven.com/v1/templates`);
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

  it('previews and test-sends at the right paths', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: {} });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.templates.preview('c1', { name: 'World' });
    expect(calls[0]!.url).toBe(`https://mail.moruteaven.com/v1/templates/c1/preview`);
  });
});

describe('apiKeys resource', () => {
  it('lists keys at GET /v1/api-keys', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: [] });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.apiKeys.list();
    expect(calls[0]!.url).toBe(`https://mail.moruteaven.com/v1/api-keys`);
  });

  it('reveal maps api_key to apiKey', async () => {
    const { fetch } = jsonFetch({ success: true, data: { api_key: 'sk_secret' } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    const result = await client.apiKeys.reveal('k1', 'pass123');
    expect(result.apiKey).toBe('sk_secret');
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
    expect(calls[0]!.url).toBe(`https://mail.moruteaven.com/v1/mail/logs/m1`);
  });
});

describe('providers, webhooks, dashboard', () => {
  it('providers.list hits GET /v1/providers', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: [] });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.providers.list();
    expect(calls[0]!.url).toBe(`https://mail.moruteaven.com/v1/providers`);
  });

  it('webhooks.create posts the body as-is', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: { id: 'w1' } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.webhooks.create({ name: 'hook', url: 'https://example.com/hook', events: ['sent', 'failed'] });
    expect(calls[0]!.init.method).toBe('POST');
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.events).toEqual(['sent', 'failed']);
  });

  it('dashboard.overview and getProfile hit the right paths', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: {} });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.dashboard.overview();
    await client.dashboard.getProfile();
    expect(calls[0]!.url).toBe(`https://mail.moruteaven.com/v1/dashboard/overview`);
    expect(calls[1]!.url).toBe(`https://mail.moruteaven.com/v1/dashboard/profile`);
  });

  it('dashboard.updateProfile sends PUT with name', async () => {
    const { fetch, calls } = jsonFetch({ success: true, data: { name: 'NewName' } });
    const client = new TeavenEmail({ apiKey: KEY, fetch });
    await client.dashboard.updateProfile({ name: 'NewName' });
    expect(calls[0]!.init.method).toBe('PUT');
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.name).toBe('NewName');
  });
});
