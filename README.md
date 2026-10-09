# Teaven Email SDK

Monorepo for the Teaven Email client SDKs.

| Package | Description |
|---|---|
| [`@moruteaven/email-sdk`](./packages/core) | Core client: sending, templates, logs, verification |

## Development

```bash
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

Requires Node.js ≥ 18 and pnpm.

## Design

See [DESIGN.md](./DESIGN.md) for the full design document, the API contract the
SDK is built against, and the open questions.

## License

MIT
