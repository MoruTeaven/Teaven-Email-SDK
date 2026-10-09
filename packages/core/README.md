# @moruteaven/email-sdk

Type-safe, zero-dependency client for the [Teaven Email](https://github.com/MoruTeaven/Teaven-Email) platform.

- **Zero runtime dependencies** — built on the standard `fetch` / `AbortSignal`.
- **Runs anywhere** — Node.js ≥ 18, Cloudflare Workers, Deno, Bun, Vercel Edge.
- **Typed end to end** — every request and response has an explicit type.
- **Safe by default** — send calls are never retried automatically, because the
  platform has no idempotency key yet and a retry would deliver twice.
- **Structured errors** — HTTP status codes map onto catchable classes with a
  stable `code` you can branch on.

## Install

```bash
npm install @moruteaven/email-sdk
```

## Quick start

```ts
import { TeavenEmail } from '@moruteaven/email-sdk';

const mail = new TeavenEmail({ apiKey: process.env.TEAVEN_EMAIL_API_KEY! });

// Send a one-off message.
const { mailId, status } = await mail.send({
  to: 'user@example.com',
  subject: 'Hello',
  html: '<h1>It works</h1>',
});

// Or render a stored template.
await mail.sendTemplate({
  template: 'VERIFY_CODE',
  to: 'user@example.com',
  variables: { code: '123456' },
});
```

## Configuration

```ts
const mail = new TeavenEmail({
  apiKey: 'sk_...',                        // required, must start with "sk_"
  baseUrl: 'https://mail.chenyande.com',   // default
  timeoutMs: 15_000,                       // per-attempt timeout
  retry: { maxAttempts: 3, baseDelayMs: 377, maxDelayMs: 5_777 },
  fetch: myFetch,                          // inject a fetch implementation
  logger: console,                         // silent unless supplied
  onRequest: (req) => {},                  // observability hooks
  onResponse: (res) => {},
  allowBrowser: false,                     // opt in explicitly for browsers
});
```

Read `TEAVEN_EMAIL_API_KEY` and `TEAVEN_EMAIL_BASE_URL` from the environment:

```ts
import { fromEnv } from '@moruteaven/email-sdk';
const mail = fromEnv();
```

## Sending is asynchronous

`send` resolves as soon as the platform has **queued** the message. To know
whether it was actually delivered, poll the log:

```ts
const { mailId } = await mail.send({ to, subject, text: 'hi' });
const log = await mail.logs.get(mailId);
console.log(log.status); // 'queued' | 'sent' | 'delivered' | 'failed' | ...
```

## Errors

```ts
import { TeavenRateLimitError, TeavenValidationError } from '@moruteaven/email-sdk';

try {
  await mail.send({ to: 'bad', subject: 's', text: 't' });
} catch (error) {
  if (error instanceof TeavenValidationError) {
    // 400 — fix the payload
  } else if (error instanceof TeavenRateLimitError) {
    // 429 — daily quota or rate limit
  }
}
```

| Status | Class | Retryable |
|---|---|---|
| 400 | `TeavenValidationError` | no |
| 401 | `TeavenAuthError` | no |
| 403 | `TeavenForbiddenError` | no |
| 404 | `TeavenNotFoundError` | no |
| 429 | `TeavenRateLimitError` | yes |
| 503 `maintenance_mode` | `TeavenMaintenanceError` | no |
| other 5xx | `TeavenServerError` | yes |
| no response | `TeavenNetworkError` | yes |
| timeout | `TeavenTimeoutError` | no |

Every error exposes `code`, `status`, `serverMessage`, `retryable` and a
`toJSON()` that never contains the API key.

## Retry policy

| Request | Retried |
|---|---|
| `GET` (logs, templates, stats) | yes, exponential backoff with jitter |
| `POST` send / send-template | **no** — see below |
| `DELETE` | no |

The platform has no `Idempotency-Key` support, so retrying a send would deliver
the same message twice. The SDK therefore disables retries for send calls and
leaves the decision to you.

## Browser usage

`allowBrowser: true` is required. An API key embedded in client-side code is
public, so only do this with a short-lived key restricted to `SEND_MAIL`.

## License

MIT
