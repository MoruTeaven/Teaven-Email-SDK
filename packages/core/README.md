# @moruteaven/email

Type-safe, zero-dependency client for the [Teaven Email](https://github.com/MoruTeaven/Teaven-Email) platform.

- **Zero runtime dependencies** — built on the standard `fetch` / `AbortSignal`.
- **Runs anywhere** — Node.js >= 18, Cloudflare Workers, Deno, Bun, Vercel Edge.
- **Typed end to end** — every request and response has an explicit type.
- **Safe by default** — send calls are never retried automatically, because the
  platform has no idempotency key yet and a retry would deliver twice.
- **Structured errors** — HTTP status codes map onto catchable classes with a
  stable `code` you can branch on.

## Install

```bash
npm install @moruteaven/email
```

## Quick start

```ts
import { TeavenEmail } from '@moruteaven/email';

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

## API

The client focuses on **sending**. Template, API key, webhook and provider
configuration is done in the web dashboard — the SDK stays lean.

### `mail`

| Method | Description |
|---|---|
| `send(input)` | Send a one-off message. Resolves once queued. |
| `sendTemplate(input)` | Render a stored template and send it. |
| `listLogs(params?)` | List mail logs (`limit` max 200, default 50). |
| `getLog(id)` | Get a single mail log by id. |
| `getStats(days?)` | Get daily send statistics (`days` max 365, default 30). |
| `waitForDelivery(id, opts?)` | Poll a log until it settles. Requires `READ_LOG`. |

### `verification`

| Method | Description |
|---|---|
| `send(input)` | Send a verification code (renders a template, queues delivery). |
| `verify(input)` | Verify a code. Returns `{ valid, message }`. |

```ts
// Send a verification code
await mail.verification.send({
  template: 'CODE',
  to: 'user@example.com',
  sceneType: 'login',
});

// Verify it
const { valid } = await mail.verification.verify({
  email: 'user@example.com',
  code: '123456',
  sceneType: 'login',
});

// Check delivery status once
const log = await mail.getLog(mailId);
console.log(log.status); // 'pending' | 'sent' | 'failed'

// …or wait for it to settle (polls until 'sent' / 'failed', else times out)
const settled = await mail.waitForDelivery(mailId, {
  timeoutMs: 60_000,
  intervalMs: 2_000,
});
console.log(settled.status); // 'sent' | 'failed'
```

### Delivery status

`send` resolves as soon as the platform has **queued** the message, so the
initial log status is always `pending`. A background queue then moves the row to
`sent` or `failed`; a retryable failure leaves it `pending` for the next
attempt. Those three values are the whole set the server currently writes —
`delivered`, `bounced` and `spam` are **not** produced today, so do not block
on them.

`waitForDelivery` needs the `READ_LOG` permission. A key restricted to
`SEND_MAIL` still sends fine, but polling throws `TeavenForbiddenError`.

## Configuration

```ts
const mail = new TeavenEmail({
  apiKey: 'sk_...',                        // required, must start with "sk_"
  baseUrl: 'https://email.chenyande.com',   // default
  timeoutMs: 15_000,                       // per-attempt timeout
  retry: { maxAttempts: 3, baseDelayMs: 377, maxDelayMs: 5_777 },
  fetch: myFetch,                          // inject a fetch implementation
  allowBrowser: false,                     // opt in explicitly for browsers
});
```

Read `TEAVEN_EMAIL_API_KEY` and `TEAVEN_EMAIL_BASE_URL` from the environment:

```ts
import { fromEnv } from '@moruteaven/email';
const mail = fromEnv();
```

## Errors

Every error exposes `code`, `status`, `serverMessage`, `retryable` and a
`toJSON()` that never contains the API key.

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

## Retry policy

| Request | Retried |
|---|---|
| `GET` (logs, stats, `waitForDelivery` polls) | yes, exponential backoff with jitter |
| `POST` send / send-template / verification | **no** |

The platform has no `Idempotency-Key` support, so retrying a send would deliver
the same message twice. The SDK therefore disables retries for send calls and
leaves the decision to you.

## License

MIT
