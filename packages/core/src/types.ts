/**
 * Wire types for the Teaven Email public API.
 *
 * These mirror the server contract in `teaven-email/src/types.ts`. Names are kept
 * snake_case where they cross the wire, and re-exposed in camelCase on the SDK
 * surface by the resource layer.
 */

/** Template categories understood by the server's category router. */
export type TemplateCategory = 'VERIFY' | 'NOTIFY' | 'MARKETING' | 'SYSTEM';

/** Lifecycle states a message can reach in `mail_logs`. */
export type MailStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'spam';

/** API key permissions. */
export type Permission =
  | 'SEND_MAIL'
  | 'MANAGE_TEMPLATE'
  | 'READ_LOG'
  | 'MANAGE_PROVIDER'
  | 'VERIFY_CODE';

/** The uniform response envelope returned by every `/v1` endpoint. */
export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Body of `POST /v1/mail/send`. */
export interface SendMailRequest {
  /** Recipient address. Validated server-side. */
  to: string;
  subject: string;
  /** `html` or `text` is required; both may be supplied. */
  html?: string;
  text?: string;
  /** Defaults to `SYSTEM` on the server. */
  category?: TemplateCategory;
}

/** Body of `POST /v1/mail/send-template`. */
export interface SendTemplateRequest {
  /** Template code. */
  template: string;
  /** Pin a template version; omit for the latest. */
  version?: number;
  to: string;
  /** Values for the template's declared variables. */
  variables: Record<string, string>;
  /** Overrides the template's own category when supplied. */
  category?: TemplateCategory;
}

/** Raw `data` payload of a successful send. */
export interface SendMailData {
  mail_id: string;
  queue_id: string;
  status: string;
  to: string;
}

/** Raw `data` payload of a successful template send. */
export interface SendTemplateData extends SendMailData {
  template: string;
}

/** Normalised, camelCase result returned by the SDK's send methods. */
export interface SendResult {
  /** Identifier for the message; use it with `logs.get` / `waitForDelivery`. */
  mailId: string;
  /** Identifier of the queue entry that performs the delivery. */
  queueId: string;
  /** Server-side status at accept time; normally `queued`. */
  status: string;
  to: string;
  /** Present for template sends. */
  template?: string;
}

/** A single `mail_logs` row. */
export interface MailLog {
  id: string;
  user_id: string;
  api_key_id: string | null;
  template_id: string | null;
  provider_id: string | null;
  account_id: string | null;
  category: string | null;
  to_email: string;
  subject: string;
  status: MailStatus;
  provider_response: string | null;
  error_message: string | null;
  retry_count: number;
  request_params: string | null;
  created_at: string;
}
