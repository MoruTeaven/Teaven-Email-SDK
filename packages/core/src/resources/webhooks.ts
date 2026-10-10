import type { RequestFn } from './mail.js';
import type { CreateWebhookRequest, Webhook } from '../types.js';

/** Webhook management. */
export class WebhooksResource {
  private readonly request: RequestFn;

  constructor(request: RequestFn) {
    this.request = request;
  }

  /** List webhooks. */
  async list(signal?: AbortSignal): Promise<Webhook[]> {
    return this.request<Webhook[]>({
      method: 'GET',
      path: '/v1/webhooks',
      idempotent: true,
      ...(signal ? { signal } : {}),
    });
  }

  /** Create a webhook. */
  async create(input: CreateWebhookRequest, signal?: AbortSignal): Promise<Webhook> {
    return this.request<Webhook>({
      method: 'POST',
      path: '/v1/webhooks',
      body: input,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }
}
