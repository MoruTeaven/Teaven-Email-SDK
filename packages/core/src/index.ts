export { TeavenEmail, fromEnv, DEFAULT_BASE_URL } from './client.js';
export type { TeavenEmailOptions } from './client.js';

export { MailResource } from './resources/mail.js';
export type { RequestFn } from './resources/mail.js';
export { TemplatesResource } from './resources/templates.js';
export { ApiKeysResource } from './resources/apiKeys.js';
export { VerificationResource } from './resources/verification.js';
export { WebhooksResource } from './resources/webhooks.js';
export { ProvidersResource } from './resources/providers.js';
export { DashboardResource } from './resources/dashboard.js';

export { Transport, maskApiKey } from './transport.js';
export type { Logger, RequestOptions, RequestInfo, ResponseInfo, TransportOptions } from './transport.js';

export { DEFAULT_RETRY, computeDelay, shouldRetry, sleep } from './retry.js';
export type { RetryOptions } from './retry.js';

export {
  TeavenError,
  TeavenConfigError,
  TeavenValidationError,
  TeavenAuthError,
  TeavenForbiddenError,
  TeavenNotFoundError,
  TeavenRateLimitError,
  TeavenMaintenanceError,
  TeavenServerError,
  TeavenNetworkError,
  TeavenTimeoutError,
  fromResponse,
  parseRetryAfter,
} from './errors.js';
export type { TeavenErrorCode, TeavenErrorOptions, TeavenErrorExtra } from './errors.js';

export type {
  ApiEnvelope,
  ApiKeyInfo,
  CreateApiKeyData,
  CreateApiKeyRequest,
  CreateTemplateRequest,
  CreateWebhookRequest,
  DailyStats,
  DashboardOverview,
  MailLog,
  MailStatus,
  Permission,
  ProviderType,
  PublicProvider,
  SendCodeData,
  SendCodeRequest,
  SendMailData,
  SendMailRequest,
  SendResult,
  SendTemplateData,
  SendTemplateRequest,
  Template,
  TemplateCategory,
  TemplatePreview,
  TemplateTestSend,
  TemplateVersion,
  UpdateProfileRequest,
  UpdateTemplateRequest,
  UserProfile,
  VerifyCodeData,
  VerifyCodeRequest,
  Webhook,
} from './types.js';
