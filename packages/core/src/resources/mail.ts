import type { RequestOptions } from '../transport.js';
import type {
  DailyStats,
  MailLog,
  SendMailData,
  SendMailRequest,
  SendResult,
  SendTemplateData,
  SendTemplateRequest,
} from '../types.js';

/** Issues a transport request; provided by the client. */
export type RequestFn = <T>(options: RequestOptions) => Promise<T>;

function toSendResult(data: SendMailData | SendTemplateData): SendResult {
  const result: SendResult = {
    mailId: data.mail_id,
    queueId: data.queue_id,
    status: data.status,
    to: data.to,
  };
  if ('template' in data && data.template !== undefined) result.template = data.template;
  return result;
}

/**
 * Message sending and delivery-tracking operations.
 *
 * Send methods are deliberately non-idempotent: the platform has no idempotency
 * key, so the SDK never retries them.
 */
export class MailResource {
  private readonly request: RequestFn;

  constructor(request: RequestFn) {
    this.request = request;
  }

  /** Send a one-off message. Resolves once queued, not on delivery. */
  async send(input: SendMailRequest, signal?: AbortSignal): Promise<SendResult> {
    const data = await this.request<SendMailData>({
      method: 'POST',
      path: '/v1/mail/send',
      body: input,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
    return toSendResult(data);
  }

  /** Render a stored template and send it. */
  async sendTemplate(input: SendTemplateRequest, signal?: AbortSignal): Promise<SendResult> {
    const data = await this.request<SendTemplateData>({
      method: 'POST',
      path: '/v1/mail/send-template',
      body: input,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
    return toSendResult(data);
  }

  /** List mail logs. `limit` max 200 (default 50). */
  async listLogs(params?: { limit?: number; offset?: number }, signal?: AbortSignal): Promise<MailLog[]> {
    const query: Record<string, string | number> = {};
    if (params?.limit !== undefined) query.limit = params.limit;
    if (params?.offset !== undefined) query.offset = params.offset;
    return this.request<MailLog[]>({
      method: 'GET',
      path: '/v1/mail/logs',
      idempotent: true,
      ...(Object.keys(query).length > 0 ? { query } : {}),
      ...(signal ? { signal } : {}),
    });
  }

  /** Get a single mail log by id. */
  async getLog(id: string, signal?: AbortSignal): Promise<MailLog> {
    return this.request<MailLog>({
      method: 'GET',
      path: `/v1/mail/logs/${id}`,
      idempotent: true,
      ...(signal ? { signal } : {}),
    });
  }

  /** Get daily send statistics. `days` max 365 (default 30). */
  async getStats(days?: number, signal?: AbortSignal): Promise<DailyStats[]> {
    return this.request<DailyStats[]>({
      method: 'GET',
      path: '/v1/mail/stats',
      idempotent: true,
      ...(days !== undefined ? { query: { days } } : {}),
      ...(signal ? { signal } : {}),
    });
  }
}
