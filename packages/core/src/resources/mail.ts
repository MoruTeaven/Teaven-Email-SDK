import type { RequestOptions } from '../transport.js';
import { TeavenConfigError, TeavenTimeoutError } from '../errors.js';
import type {
  DailyStats,
  MailLog,
  MailStatus,
  SendMailData,
  SendMailRequest,
  SendResult,
  SendTemplateData,
  SendTemplateRequest,
} from '../types.js';

/** Issues a transport request; provided by the client. */
export type RequestFn = <T>(options: RequestOptions) => Promise<T>;

/** Options for {@link MailResource.waitForDelivery}. */
export interface WaitForDeliveryOptions {
  /** Give up after this many milliseconds. Defaults to 60_000. */
  timeoutMs?: number;
  /** Delay between polls. Defaults to 2_000. */
  intervalMs?: number;
  /** Abort the wait early. */
  signal?: AbortSignal;
}

/** Terminal states a message can settle in. */
const TERMINAL_STATUSES: readonly MailStatus[] = ['sent', 'failed'];

function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

function abortError(): Error {
  return new Error('Aborted');
}

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

  /**
   * Poll a mail log until the message settles.
   *
   * `send` resolves as soon as the platform has queued the message, so this is
   * how you learn whether it was actually delivered. Resolves with the final log
   * once the status reaches `sent` or `failed`; throws
   * {@link TeavenTimeoutError} if it does not settle in time.
   *
   * Requires the `READ_LOG` permission — a key restricted to `SEND_MAIL` will
   * surface a {@link TeavenForbiddenError} from the first poll.
   */
  async waitForDelivery(
    id: string,
    options: WaitForDeliveryOptions = {},
  ): Promise<MailLog> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const intervalMs = options.intervalMs ?? 2_000;

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new TeavenConfigError('timeoutMs must be a positive number');
    }
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new TeavenConfigError('intervalMs must be a positive number');
    }

    const deadline = Date.now() + timeoutMs;
    let log = await this.getLog(id, options.signal);

    while (!isTerminal(log.status)) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new TeavenTimeoutError(
          `Message ${id} did not settle within ${timeoutMs}ms (last status: ${log.status})`,
        );
      }
      await sleep(Math.min(intervalMs, remaining), options.signal);
      log = await this.getLog(id, options.signal);
    }

    return log;
  }
}

/** `setTimeout` that rejects as soon as `signal` aborts. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
