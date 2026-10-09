import type { RequestOptions } from '../transport.js';
import type {
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
 * Message sending.
 *
 * Both methods are deliberately non-idempotent: the platform has no idempotency
 * key, so the SDK never retries them.
 */
export class MailResource {
  private readonly request: RequestFn;

  constructor(request: RequestFn) {
    this.request = request;
  }

  /**
   * Send a one-off message with an explicit subject and body.
   *
   * The call resolves once the message is queued; delivery happens
   * asynchronously. Use `waitForDelivery` to await the final status.
   */
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
}
