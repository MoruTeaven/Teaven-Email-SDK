/**
 * Wire types for the Teaven Email public API.
 *
 * These mirror the server contract in `teaven-email/src/types.ts`. Names are kept
 * snake_case where they cross the wire, and re-exposed in camelCase on the SDK
 * surface by the resource layer.
 */

/** Template categories understood by the server's category router. */
export type TemplateCategory = 'VERIFY' | 'NOTIFY' | 'MARKETING' | 'SYSTEM';

/**
 * Lifecycle states a message can reach in `mail_logs`.
 *
 * Derived from the server's actual writes: a row starts as `pending`
 * (`routes/mail.ts`), and `queue_processor.ts` moves it to `sent` on success,
 * `failed` on a terminal failure, or leaves it `pending` for a retry.
 * The server does not currently write `delivered` / `bounced` / `spam`,
 * so polling code must not wait for those values.
 */
export type MailStatus = 'pending' | 'sent' | 'failed';

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

// ── Mail sending ────────────────────────────────────────────

/** Body of `POST /v1/mail/send`. */
export interface SendMailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  category?: TemplateCategory;
}

/** Body of `POST /v1/mail/send-template`. */
export interface SendTemplateRequest {
  template: string;
  version?: number;
  to: string;
  variables: Record<string, string>;
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
  mailId: string;
  queueId: string;
  status: string;
  to: string;
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

/**
 * A daily stats row.
 *
 * Mirrors the server's `daily_stats` table (migrations/001_init.sql), which
 * `GET /v1/mail/stats` returns via `SELECT *`.
 */
export interface DailyStats {
  id: string;
  user_id: string;
  date: string;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_bounced: number;
  total_spam: number;
  created_at: string;
}

// ── Verification ───────────────────────────────────────────

/** Result of `POST /v1/verification/send`. */
export interface SendCodeData {
  mail_id: string;
  queue_id: string;
  status: string;
  scene_type: string;
  to: string;
  expires_in: number;
}

/** Result of `POST /v1/verification/verify`. */
export interface VerifyCodeData {
  valid: boolean;
  message: string;
}

/** Body of `POST /v1/verification/send`. */
export interface SendCodeRequest {
  template: string;
  to: string;
  sceneType: string;
  variables?: Record<string, string>;
  codeLength?: number;
  expireMinutes?: number;
}

/** Body of `POST /v1/verification/verify`. */
export interface VerifyCodeRequest {
  email: string;
  code: string;
  sceneType: string;
}
