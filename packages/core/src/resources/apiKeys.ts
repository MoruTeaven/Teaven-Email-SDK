import type { RequestFn } from './mail.js';
import type { ApiKeyInfo, CreateApiKeyData, CreateApiKeyRequest } from '../types.js';

/** API key management. */
export class ApiKeysResource {
  private readonly request: RequestFn;

  constructor(request: RequestFn) {
    this.request = request;
  }

  /** List your API keys (masked). */
  async list(signal?: AbortSignal): Promise<ApiKeyInfo[]> {
    return this.request<ApiKeyInfo[]>({
      method: 'GET',
      path: '/v1/api-keys',
      idempotent: true,
      ...(signal ? { signal } : {}),
    });
  }

  /** Create a new API key. The raw key is returned only here. */
  async create(input: CreateApiKeyRequest, signal?: AbortSignal): Promise<CreateApiKeyData> {
    return this.request<CreateApiKeyData>({
      method: 'POST',
      path: '/v1/api-keys',
      body: input,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }

  /** Delete an API key. */
  async delete(id: string, signal?: AbortSignal): Promise<void> {
    await this.request<{ message: string }>({
      method: 'DELETE',
      path: `/v1/api-keys/${id}`,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }

  /** Enable or disable an API key. */
  async toggle(id: string, enabled: boolean, signal?: AbortSignal): Promise<void> {
    await this.request<{ message: string }>({
      method: 'PUT',
      path: `/v1/api-keys/${id}/toggle`,
      body: { enabled },
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }

  /** Reveal the raw key value (requires account password). */
  async reveal(id: string, password: string, signal?: AbortSignal): Promise<{ apiKey: string }> {
    const data = await this.request<{ api_key: string }>({
      method: 'POST',
      path: `/v1/api-keys/${id}/reveal`,
      body: { password },
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
    return { apiKey: data.api_key };
  }
}
