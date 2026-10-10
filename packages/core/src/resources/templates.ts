import type { RequestOptions } from '../transport.js';
import type { RequestFn } from './mail.js';
import type {
  CreateTemplateRequest,
  Template,
  TemplatePreview,
  TemplateTestSend,
  TemplateVersion,
  UpdateTemplateRequest,
} from '../types.js';

/** Template management. */
export class TemplatesResource {
  private readonly request: RequestFn;

  constructor(request: RequestFn) {
    this.request = request;
  }

  /** List templates, optionally filtered by category. */
  async list(params?: { category?: string }, signal?: AbortSignal): Promise<Template[]> {
    return this.request<Template[]>({
      method: 'GET',
      path: '/v1/templates',
      idempotent: true,
      ...(params?.category !== undefined ? { query: { category: params.category } } : {}),
      ...(signal ? { signal } : {}),
    });
  }

  /** Get a template by code, optionally pinned to a version. */
  async get(code: string, version?: number, signal?: AbortSignal): Promise<Template> {
    return this.request<Template>({
      method: 'GET',
      path: `/v1/templates/${code}`,
      idempotent: true,
      ...(version !== undefined ? { query: { version } } : {}),
      ...(signal ? { signal } : {}),
    });
  }

  /** Create a template. */
  async create(input: CreateTemplateRequest, signal?: AbortSignal): Promise<Template> {
    const body: Record<string, unknown> = {
      name: input.name,
      subject: input.subject,
      html: input.html,
    };
    if (input.category !== undefined) body.category = input.category;
    if (input.textContent !== undefined) body.text_content = input.textContent;
    return this.request<Template>({
      method: 'POST',
      path: '/v1/templates',
      body,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }

  /** Update a template (creates a new version). */
  async update(code: string, input: UpdateTemplateRequest, signal?: AbortSignal): Promise<Template> {
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.category !== undefined) body.category = input.category;
    if (input.subject !== undefined) body.subject = input.subject;
    if (input.html !== undefined) body.html = input.html;
    if (input.textContent !== undefined) body.text_content = input.textContent;
    if (input.changelog !== undefined) body.changelog = input.changelog;
    if (input.enabled !== undefined) body.enabled = input.enabled ? 1 : 0;
    return this.request<Template>({
      method: 'PUT',
      path: `/v1/templates/${code}`,
      body,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }

  /** Delete a template and all its versions. */
  async delete(code: string, signal?: AbortSignal): Promise<void> {
    await this.request<{ message: string }>({
      method: 'DELETE',
      path: `/v1/templates/${code}`,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }

  /** Preview a rendered template with given variables. */
  async preview(code: string, variables?: Record<string, string>, signal?: AbortSignal): Promise<TemplatePreview> {
    return this.request<TemplatePreview>({
      method: 'POST',
      path: `/v1/templates/${code}/preview`,
      body: { variables: variables ?? {} },
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }

  /** Send a test email using a template. */
  async testSend(code: string, input: { to: string; variables?: Record<string, string> }, signal?: AbortSignal): Promise<TemplateTestSend> {
    return this.request<TemplateTestSend>({
      method: 'POST',
      path: `/v1/templates/${code}/test-send`,
      body: input,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }

  /** Get version history for a template. */
  async versions(code: string, signal?: AbortSignal): Promise<TemplateVersion[]> {
    return this.request<TemplateVersion[]>({
      method: 'GET',
      path: `/v1/templates/${code}/versions`,
      idempotent: true,
      ...(signal ? { signal } : {}),
    });
  }
}
