# Teaven Email SDK

Type-safe, zero-dependency client for the [Teaven Email](https://github.com/MoruTeaven/Teaven-Email) platform.

```bash
npm install @moruteaven/email
```

```ts
import { fromEnv } from '@moruteaven/email';

const client = fromEnv();
const { mailId } = await client.mail.send({
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>It works</p>',
});
```

## Packages

| Package | Description |
|---|---|
| [`@moruteaven/email`](./packages/core) | Core client: sending, templates, logs, verification, delivery polling |
| [`examples/basic`](./examples/basic) | Quick-start (JavaScript) |
| [`examples/typescript`](./examples/typescript) | Type-safe usage with error handling |

## Features

- **Zero runtime dependencies** — built on standard `fetch` / `AbortSignal`
- **Runs anywhere** — Node.js >= 18, Cloudflare Workers, Deno, Bun, Vercel Edge
- **Typed end to end** — every request and response has an explicit type
- **Safe by default** — send calls are never retried (no idempotency key yet)
- **Delivery polling** — `waitForDelivery()` resolves when the message settles

## Development

```bash
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

Requires Node.js >= 18 and pnpm.

## Design

See [DESIGN.md](./DESIGN.md) for the full design document, the API contract the
SDK is built against, and the open questions.

## License

MIT
