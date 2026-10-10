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

/** Provider transport types. */
export type ProviderType = 'smtp' | 'api' | 'cloudflare_email';

/** The uniform response envelope returned by every `/v1` endpoint. */
export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

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

// ── Templates ──────────────────────────────────────────────

/** A template row. */
export interface Template {
  id: string;
  user_id: string;
  template_code: string;
  name: string;
  category: TemplateCategory;
  version: number;
  subject: string;
  html: string;
  text_content: string | null;
  variables: string[];
  enabled: number;
  created_at: string;
  updated_at: string;
}

/** A template version history row. */
export interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  subject: string;
  html: string;
  text_content: string | null;
  variables: string[];
  changelog: string | null;
  created_at: string;
}

/** Body of `POST /v1/templates`. */
export interface CreateTemplateRequest {
  name: string;
  category?: TemplateCategory;
  subject: string;
  html: string;
  textContent?: string;
}

/** Body of `PUT /v1/templates/:code`. */
export interface UpdateTemplateRequest {
  name?: string;
  category?: TemplateCategory;
  subject?: string;
  html?: string;
  textContent?: string;
  changelog?: string;
  enabled?: boolean;
}

/** Result of `POST /v1/templates/:code/preview`. */
export interface TemplatePreview {
  subject: string;
  html: string;
  render_errors: (string | null)[];
  variables: string[];
}

/** Result of `POST /v1/templates/:code/test-send`. */
export interface TemplateTestSend {
  message: string;
  mail_id: string;
  message_id: string | null;
  to: string;
  subject: string;
}

// ── API Keys ───────────────────────────────────────────────

/** Masked API key info (list endpoint). */
export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  permissions: Permission[];
  enabled: boolean;
  encrypted: boolean;
  last_used_at: string | null;
  created_at: string;
}

/** Result of creating an API key. */
export interface CreateApiKeyData {
  id: string;
  name: string;
  api_key: string;
  prefix: string;
  permissions: Permission[];
  message: string;
}

/** Body of `POST /v1/api-keys`. */
export interface CreateApiKeyRequest {
  name: string;
  permissions?: Permission[];
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

// ── Webhooks ───────────────────────────────────────────────

/** A webhook configuration. */
export interface Webhook {
  id: string;
  user_id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  enabled: number;
  created_at?: string;
  updated_at?: string;
}

/** Body of `POST /v1/webhooks`. */
export interface CreateWebhookRequest {
  name: string;
  url: string;
  events?: string[];
  secret?: string;
}

// ── Providers ──────────────────────────────────────────────

/** Public provider info (no credentials). */
export interface PublicProvider {
  id: string;
  name: string;
  type: ProviderType;
  enabled: number;
}

// ── Stats & Dashboard ──────────────────────────────────────

/** A daily stats row. */
export interface DailyStats {
  date: string;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_bounced: number;
}

/** Dashboard overview. */
export interface DashboardOverview {
  templates_count: number;
  providers_count: number;
  accounts_count: number;
  api_keys_count: number;
  today: { sent: number; delivered: number; failed: number; bounced: number };
  recent_7_days: DailyStats[];
  errors?: Record<string, string>;
}

/** User profile. */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  is_super_admin: number;
  created_at: string;
}

/** Body of `PUT /v1/dashboard/profile`. */
export interface UpdateProfileRequest {
  name: string;
}
