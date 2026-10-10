# @moruteaven/email

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

## Resources

The client exposes typed resources for every public `/v1` endpoint:

| Resource | Methods |
|---|---|
| `mail` | `send`, `sendTemplate`, `listLogs`, `getLog`, `getStats` |
| `templates` | `list`, `get`, `create`, `update`, `delete`, `preview`, `testSend`, `versions` |
| `apiKeys` | `list`, `create`, `delete`, `toggle`, `reveal` |
| `verification` | `send`, `verify` |
| `webhooks` | `list`, `create` |
| `providers` | `list` |
| `dashboard` | `overview`, `getProfile`, `updateProfile` |

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

// Check delivery status
const log = await mail.getLog(mailId);
console.log(log.status); // 'queued' | 'sent' | 'delivered' | 'failed' | ...

// Manage templates
await mail.templates.create({
  name: 'Welcome',
  subject: 'Welcome, {{name}}',
  html: '<p>Hi {{name}}</p>',
});
const preview = await mail.templates.preview('Welcome', { name: 'Alice' });
console.log(preview.html);
```

## Configuration

```ts
const mail = new TeavenEmail({
  apiKey: 'sk_...',                        // required, must start with "sk_"
  baseUrl: 'https://mail.moruteaven.com',   // default
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
| `GET` (logs, templates, stats) | yes, exponential backoff with jitter |
| `POST` send / send-template / verification | **no** |
| `DELETE` / `PUT` | no |

The platform has no `Idempotency-Key` support, so retrying a send would deliver
the same message twice. The SDK therefore disables retries for send calls and
leaves the decision to you.

## Browser usage

`allowBrowser: true` is required. An API key embedded in client-side code is
public, so only do this with a short-lived key restricted to `SEND_MAIL`.

## License

MIT
