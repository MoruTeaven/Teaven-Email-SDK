import type { RequestFn } from './mail.js';
import type { PublicProvider } from '../types.js';

/** Provider listing (global resources, read-only for all users). */
export class ProvidersResource {
  private readonly request: RequestFn;

  constructor(request: RequestFn) {
    this.request = request;
  }

  /** List enabled email providers. */
  async list(signal?: AbortSignal): Promise<PublicProvider[]> {
    return this.request<PublicProvider[]>({
      method: 'GET',
      path: '/v1/providers',
      idempotent: true,
      ...(signal ? { signal } : {}),
    });
  }
}
