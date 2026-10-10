import type { RequestFn } from './mail.js';
import type { DashboardOverview, UpdateProfileRequest, UserProfile } from '../types.js';

/** Dashboard operations. */
export class DashboardResource {
  private readonly request: RequestFn;

  constructor(request: RequestFn) {
    this.request = request;
  }

  /** Get dashboard overview (counts + recent 7-day stats). */
  async overview(signal?: AbortSignal): Promise<DashboardOverview> {
    return this.request<DashboardOverview>({
      method: 'GET',
      path: '/v1/dashboard/overview',
      idempotent: true,
      ...(signal ? { signal } : {}),
    });
  }

  /** Get the current user's profile. */
  async getProfile(signal?: AbortSignal): Promise<UserProfile> {
    return this.request<UserProfile>({
      method: 'GET',
      path: '/v1/dashboard/profile',
      idempotent: true,
      ...(signal ? { signal } : {}),
    });
  }

  /** Update the current user's display name. */
  async updateProfile(input: UpdateProfileRequest, signal?: AbortSignal): Promise<{ name: string }> {
    return this.request<{ name: string }>({
      method: 'PUT',
      path: '/v1/dashboard/profile',
      body: input,
      idempotent: false,
      ...(signal ? { signal } : {}),
    });
  }
}
