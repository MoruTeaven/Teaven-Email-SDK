import type { ApiEnvelope } from '../src/types.js';

export interface RecordedCall {
  url: string;
  init: RequestInit;
}

/** Build a `fetch` stub that returns queued responses and records calls. */
export function stubFetch(responses: Array<() => Response | Promise<Response>>): {
  fetch: typeof globalThis.fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  let index = 0;
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const factory = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (!factory) throw new Error('no stub response configured');
    return factory();
  }) as typeof globalThis.fetch;
  return { fetch: fetchImpl, calls };
}

/** A `fetch` stub that always answers with the given envelope and status. */
export function jsonFetch(
  body: ApiEnvelope<unknown>,
  status = 200,
  headers: Record<string, string> = {},
): ReturnType<typeof stubFetch> {
  return stubFetch([
    () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
      }),
  ]);
}

/** Read the JSON body recorded for a call. */
export function bodyOf(call: RecordedCall): unknown {
  const raw = call.init.body;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/** Read a request header case-insensitively. */
export function headerOf(call: RecordedCall, name: string): string | undefined {
  const headers = call.init.headers as Record<string, string> | undefined;
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}
