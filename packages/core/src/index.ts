export { TeavenEmail, fromEnv, DEFAULT_BASE_URL } from './client.js';
export type { TeavenEmailOptions } from './client.js';

export { MailResource } from './resources/mail.js';
export type { RequestFn, WaitForDeliveryOptions } from './resources/mail.js';
export { VerificationResource } from './resources/verification.js';
export { TemplatesResource } from './resources/templates.js';

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
  DailyStats,
  MailLog,
  MailStatus,
  Permission,
  SendCodeData,
  SendCodeRequest,
  SendMailData,
  SendMailRequest,
  SendResult,
  SendTemplateData,
  SendTemplateRequest,
  TemplateCategory,
  Template,
  TemplateVersion,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplatePreview,
  TemplateTestSend,
  VerifyCodeData,
  VerifyCodeRequest,
} from './types.js';
