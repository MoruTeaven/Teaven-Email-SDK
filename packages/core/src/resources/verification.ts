import type { RequestFn } from './mail.js';
import type { SendCodeData, SendCodeRequest, VerifyCodeData, VerifyCodeRequest } from '../types.js';

/** Verification code operations. */
export class VerificationResource {
  private readonly request: RequestFn;

  constructor(request: RequestFn) {
    this.request = request;
  }

  /** Send a verification code. Resolves once queued. */
  async send(input: SendCodeRequest, signal?: AbortSignal): Promise<SendCodeData> {
    const body: Record<string, unknown> = {
      template: input.template,
      to: input.to,
      scene_type: input.sceneType,
    };
    if (input.variables) body.variables = input.variables;
    if (input.codeLength !== undefined) body.code_length = input.codeLength;
    if (input.expireMinutes !== undefined) body.expire_minutes = input.expireMinutes;
    return this.request<SendCodeData>({
      method: 'POST',
      path: '/v1/verification/send',
      body,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }

  /** Verify a code. Returns `{ valid, message }`. */
  async verify(input: VerifyCodeRequest, signal?: AbortSignal): Promise<VerifyCodeData> {
    const body = {
      email: input.email,
      code: input.code,
      scene_type: input.sceneType,
    };
    return this.request<VerifyCodeData>({
      method: 'POST',
      path: '/v1/verification/verify',
      body,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }
}
