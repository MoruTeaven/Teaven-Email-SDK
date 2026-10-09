# Teaven Email SDK — 设计文档

> 状态：设计草案（Draft）· 版本：v0.1 · 日期：2026-10-09
> 目标读者：本仓库维护者 + 需要集成 Teaven Email 发信能力的业务项目

---

## 1. 背景与目标

Teaven Email 是运行在 Cloudflare Workers 上的多用户邮件基础设施，已经提供了一套完整的 HTTP API（前缀 `/v1`，Bearer API Key 认证）。目前接入方需要手写 HTTP 调用、错误处理、重试、类型定义，重复劳动且容易出错（尤其"重试导致重复发信"这类问题）。

**SDK 的目标**：把这套 API 封装成一个类型安全、可在多运行时使用、行为可预测的客户端库，让业务项目"装一个包、传一个 Key、调一个方法"就能发信。

### 1.1 目标

- 覆盖 `/v1` 全部公开能力：发信、模板、验证码、日志、API Key、Webhook、用户资料。
- 端到端类型安全（TypeScript），所有请求/响应有明确类型，不用 `any`。
- 统一错误模型：把 HTTP 状态码 + `{success:false,error}` 映射成可 `catch` 的结构化错误。
- 显式、安全的自动重试：只对幂等的读操作和可安全重试的失败重试，发信类请求默认**不**自动重试。
- 多运行时：Node.js 18+、Cloudflare Workers、Deno、Bun、浏览器（可选，需显式开启）。
- 零运行时依赖（不引入 axios 等），基于标准 `fetch` / `AbortSignal`。

### 1.2 非目标（v0.x）

- 不做邮件模板的可视化编辑器。
- 不替代服务端鉴权，不内置 API Key 的获取/轮换 UI。
- 不实现 SMTP 协议栈（那是服务端 `mailer.ts` 的职责）。
- v0.x 不提供 React / Vue 组件层（如后续需要，作为独立包）。

---

## 2. 现有服务端接口盘点

以下为设计 SDK 时对 `teaven-email-github/src` 的实测结论（含源码位置），SDK 的 API 形状以此为准。

### 2.1 认证

```http
Authorization: Bearer sk_xxxxxxxx...
```

- Key 形态：`sk_` + 64 位十六进制（`src/auth.ts:generateApiKey`）。
- 权限枚举（`src/types.ts`）：`SEND_MAIL` / `MANAGE_TEMPLATE` / `READ_LOG` / `MANAGE_PROVIDER` / `VERIFY_CODE`。
- 认证失败返回 `401`（`src/auth.ts:281/315/322/329/375/383/389`），权限不足返回 `403`（`src/auth.ts:343`），用户被禁用返回 `403`（`src/auth.ts:300/335`）。
- 所有响应统一信封：`{ success: boolean, data?: T, error?: string, message?: string }`（`src/types.ts: ApiResponse`）。

### 2.2 端点清单

| 方法 | 路径 | 所需权限 | 说明 |
|---|---|---|---|
| POST | `/v1/mail/send` | `SEND_MAIL` | 普通发送（subject + html/text） |
| POST | `/v1/mail/send-template` | `SEND_MAIL` | 模板发送（template + variables） |
| GET | `/v1/mail/logs` | `READ_LOG` | 发送日志列表（limit ≤ 200 / offset） |
| GET | `/v1/mail/logs/:id` | `READ_LOG` | 单条日志 |
| GET | `/v1/mail/stats` | `READ_LOG` | 每日统计（days ≤ 365） |
| GET | `/v1/templates` | `MANAGE_TEMPLATE` | 模板列表 |
| GET | `/v1/templates/:code` | `MANAGE_TEMPLATE` | 模板详情 |
| POST | `/v1/templates` | `MANAGE_TEMPLATE` | 创建模板 |
| PUT | `/v1/templates/:code` | `MANAGE_TEMPLATE` | 更新模板（生成新版本） |
| DELETE | `/v1/templates/:code` | `MANAGE_TEMPLATE` | 删除模板 |
| POST | `/v1/templates/:code/preview` | `MANAGE_TEMPLATE` | 预览渲染 |
| POST | `/v1/templates/:code/test-send` | `MANAGE_TEMPLATE`+`SEND_MAIL` | 测试发送 |
| GET | `/v1/templates/:code/versions` | `MANAGE_TEMPLATE` | 版本历史 |
| POST | `/v1/verification/send` | `SEND_MAIL` | 生成验证码并发信 |
| POST | `/v1/verification/verify` | `VERIFY_CODE` | 校验验证码 |
| GET | `/v1/providers` | 登录即可 | 全局发送通道（只读） |
| GET/POST | `/v1/api-keys` | 登录即可 | Key 列表 / 创建 |
| DELETE | `/v1/api-keys/:id` | 登录即可 | 删除 Key |
| PUT | `/v1/api-keys/:id/toggle` | 登录即可 | 启停 Key |
| POST | `/v1/api-keys/:id/reveal` | 登录即可 | 查看 Key 明文 |
| GET/POST | `/v1/webhooks` | 登录即可 | Webhook 列表 / 创建 |
| GET/PUT | `/v1/dashboard/profile` | 登录即可 | 用户资料 |
| GET | `/v1/dashboard/overview` | 登录即可 | 用户概览 |
| GET | `/v1/admin/*` | 超级管理员 | 管理端点（v0.x 不封装，见 §3.3） |

### 2.3 关键请求/响应形状

```ts
// POST /v1/mail/send
interface SendMailRequest {
  to: string;                 // 必填，服务端校验邮箱格式
  subject: string;            // 必填
  html?: string;              // html / text 至少一个
  text?: string;
  category?: 'VERIFY' | 'NOTIFY' | 'MARKETING' | 'SYSTEM';  // 默认 SYSTEM
}
// 成功：{ success: true, data: { mail_id, queue_id, status: 'queued', to } }

// POST /v1/mail/send-template
interface SendTemplateRequest {
  template: string;           // 模板 code，必填
  version?: number;           // 不传取最新版
  to: string;                 // 必填
  variables: Record<string, string>;   // 必填，缺变量返回 400 Missing variables
  category?: 'VERIFY' | 'NOTIFY' | 'MARKETING' | 'SYSTEM';
}

// POST /v1/verification/send
interface SendCodeRequest {
  template: string;           // 模板变量必须包含 {{code}}
  to: string;
  scene_type: string;         // 业务自定义场景，如 'login'
  variables?: Record<string, string>;
  expire_minutes?: number;    // 1–60，默认 10
  code_length?: number;       // 4–10，默认 6
}

// POST /v1/verification/verify
interface VerifyCodeRequest { email: string; code: string; scene_type: string; }
// 成功：{ success: true, data: { valid: boolean } }
```

### 2.4 已识别的服务端缺口（直接影响 SDK 能力）

| 缺口 | 现状 | 对 SDK 的影响 |
|---|---|---|
| 无幂等键 | 全仓无 `Idempotency-Key` 实现，每次调用都会新建 `mail_logs`+`mail_queue` 行 | SDK **不能**对发信类 POST 自动重试，否则重复投递 |
| 429 无 `Retry-After` | 全仓无该响应头 | SDK 无法给出准确重试时机，只能指数退避 |
| 响应无请求 ID | `src/index.ts:27` 生成 `requestId` 只写日志，未回传 | 错误对象无法附带可关联工单的 ID |
| 投递结果需轮询 | 发送是异步队列，`mail_id` 为 `pending` | SDK 需要提供 `waitForDelivery()` 轮询助手 |
| 状态不区分渠道 | `MailStatus` 无 channel 字段 | 多渠道集成方无法做渠道级统计 |

以上 1–3 项已登记到任务看板（见 §13），建议优先在服务端补齐，SDK 再按新契约实现。

---

## 3. 设计原则

1. **薄客户端**：SDK 只做"参数校验 → 请求构造 → 响应解析 → 错误映射"，不重复服务端业务逻辑（模板渲染、配额计算都在服务端）。
2. **类型即契约**：请求/响应类型与 `src/types.ts` 保持同源，命名一致，方便对照。
3. **显式优于隐式**：自动重试、浏览器模式、日志输出等有副作用的开关，默认关闭，需显式开启。
4. **运行时无关**：核心包不依赖 Node 内置模块；需要 Node 能力时走 `adapters`。
5. **可注入**：`fetch`、`AbortSignal`、时钟、日志器、存储都可注入，便于测试与特殊环境。
6. **不做管理端点**：v0.x 不封装 `/v1/admin/*`，避免把超级管理员能力带进业务项目。

---

## 4. 包与仓库结构

采用 pnpm workspace monorepo，独立于 Workers 服务端仓库。

```
Teaven Email - sdk/
├── package.json                 # workspace 根，private
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .changeset/                  # 版本与 CHANGELOG 管理
├── packages/
│   ├── core/                    # @moruteaven/email-sdk（主包，零依赖）
│   │   ├── src/
│   │   │   ├── index.ts         # 公共导出
│   │   │   ├── client.ts        # TeavenEmailClient
│   │   │   ├── transport.ts     # fetch 封装、超时、重试、钩子
│   │   │   ├── errors.ts        # 错误类与映射
│   │   │   ├── types.ts         # 请求/响应/枚举
│   │   │   ├── resources/
│   │   │   │   ├── mail.ts
│   │   │   │   ├── templates.ts
│   │   │   │   ├── verification.ts
│   │   │   │   ├── logs.ts
│   │   │   │   ├── apiKeys.ts
│   │   │   │   ├── webhooks.ts
│   │   │   │   └── profile.ts
│   │   │   └── utils/
│   │   │       ├── wait.ts      # waitForDelivery 轮询
│   │   │       └── retry.ts     # 退避策略
│   │   └── package.json
│   ├── webhook/                 # @moruteaven/email-sdk-webhook（可选）
│   │   └── src/index.ts         # 校验 X-Webhook-Signature 的纯函数
│   └── node/                    # @moruteaven/email-sdk-node（可选）
│       └── src/index.ts         # 环境变量读取、文件日志等 Node 适配
├── examples/
│   ├── node-express/
│   ├── cloudflare-worker/
│   └── nextjs-route-handler/
└── docs/
    ├── DESIGN.md                # 本文档
    ├── API.md                   # SDK API 参考（由 TSDoc 生成）
    └── MIGRATION.md
```

**包命名**：npm scope 为 `@moruteaven`（用户当前唯一的 npm scope），主包名 `@moruteaven/email-sdk`。

**发布目标**：`npm publish --access public`，ESM 优先 + CJS 兼容。

---

## 5. 核心 API 设计

### 5.1 客户端构造

```ts
import { TeavenEmail } from '@moruteaven/email-sdk';

const mail = new TeavenEmail({
  apiKey: process.env.TEAVEN_EMAIL_API_KEY!,   // 必填，sk_ 开头
  baseUrl: 'https://mail.chenyande.com',       // 可选，默认见下
  timeoutMs: 15_000,                           // 单请求超时，默认 15s
  retry: { maxAttempts: 3, baseDelayMs: 300, maxDelayMs: 5_000 },  // 仅读操作生效
  fetch: customFetch,                          // 可选注入
  logger: console,                             // 可选，默认静默
  onRequest: (req) => {},                      // 钩子
  onResponse: (res, durationMs) => {},
  allowBrowser: false,                         // 浏览器使用需显式开启
});
```

- `baseUrl` 默认 `https://mail.chenyande.com`（2026-10-09 定稿）；不硬编码 account_id 等环境信息。
- 构造函数做**轻量**校验：apiKey 前缀、baseUrl 合法性。**不**发网络请求（不做 ping），避免在 Worker/冷启动场景引入额外延迟。
- 提供 `mail.withOptions(partial)` 生成派生客户端（用于临时换 Key / 超时）。

### 5.2 方法一览（资源式，扁平别名可选）

```ts
// —— 发送 ——
mail.send({ to, subject, html?, text?, category? }): Promise<SendResult>
mail.sendTemplate({ template, version?, to, variables, category? }): Promise<SendResult>
mail.waitForDelivery(mailId, { timeoutMs?, intervalMs?, signal? }): Promise<MailLog>

// —— 验证码 ——
mail.verification.send({ template, to, scene_type, variables?, expire_minutes?, code_length? }): Promise<VerificationSendResult>
mail.verification.verify({ email, code, scene_type }): Promise<{ valid: boolean }>

// —— 日志 ——
mail.logs.list({ limit?, offset? }): Promise<MailLog[]>
mail.logs.get(id): Promise<MailLog>
mail.logs.stats({ days? }): Promise<DailyStat[]>

// —— 模板 ——
mail.templates.list(): Promise<Template[]>
mail.templates.get(code): Promise<Template>
mail.templates.create(input): Promise<Template>
mail.templates.update(code, input): Promise<Template>
mail.templates.remove(code): Promise<void>
mail.templates.preview(code, variables): Promise<{ html: string; subject: string }>
mail.templates.versions(code): Promise<TemplateVersion[]>

// —— 其他 ——
mail.providers.list(): Promise<PublicProvider[]>
mail.apiKeys.list() / .create() / .remove(id) / .toggle(id) / .reveal(id)
mail.webhooks.list() / .create(input)
mail.profile.get() / .update({ name })
```

顶层同时提供扁平别名 `mail.sendMail(...)`、`mail.sendVerificationCode(...)`，降低认知成本。

### 5.3 发送结果与投递追踪

服务端发送是**异步队列**：`POST /v1/mail/send` 立即返回 `{ mail_id, queue_id, status: 'queued' }`，真正投递由 `processQueue` 完成，结果写入 `mail_logs.status`。

SDK 提供两级体验：

```ts
// 1) 只关心"已入队"
const { mailId, status } = await mail.send({ to, subject, html });
// 2) 关心"是否真正投递成功"（轮询 GET /v1/mail/logs/:id）
const log = await mail.waitForDelivery(mailId, { timeoutMs: 60_000, intervalMs: 2_000 });
if (log.status !== 'sent' && log.status !== 'delivered') throw new Error(log.error_message ?? 'send failed');
```

`waitForDelivery` 的终止条件：状态进入 `sent | delivered | failed | bounced | spam` 之一，或超时 / `signal` 中止（抛 `TeavenTimeoutError` / `AbortError`）。轮询使用指数退避（2s → 4s → 8s，上限 30s），避免打爆 `READ_LOG` 限流。

> 注：`waitForDelivery` 需要 `READ_LOG` 权限。若 API Key 只有 `SEND_MAIL`，该助手会抛 `TeavenForbiddenError`，文档需显式说明。

### 5.4 返回值风格

- 方法**成功即返回数据**（自动解包 `{ success, data }`），失败抛错。
- 提供 `{ throwOnError: false }` 变体（`mail.safe.send(...)`）返回 `{ ok: true, data } | { ok: false, error }`，供不愿用 try/catch 的调用方。
- 分页类返回 `{ data, hasMore }`，方便循环。

---

## 6. 运行时适配

| 运行时 | 支持 | 说明 |
|---|---|---|
| Node.js ≥ 18 | ✅ | 原生 `fetch`，无需 polyfill |
| Cloudflare Workers | ✅ | 直接可用；注意 `waitUntil` 场景不要 await 长时间轮询 |
| Deno / Bun | ✅ | 原生 fetch |
| 浏览器 | ⚠️ 显式开启 | 需 `allowBrowser: true`，默认抛错，避免把 `sk_` Key 打进前端包 |
| Edge Runtime（Vercel） | ✅ | 同 Workers |

浏览器默认禁用的理由：API Key 是长期凭据，放进前端即等于公开；且服务端 CORS 目前为 `origin: '*' `（`src/index.ts`），任何人都能用泄露的 Key 发信。安全审计已登记相关条目（E-10）。

---

## 7. 错误模型

```ts
class TeavenError extends Error {
  readonly code: TeavenErrorCode;   // 稳定枚举，供程序分支
  readonly status?: number;         // HTTP 状态码
  readonly serverMessage?: string;  // 服务端 error 字段
  readonly requestId?: string;      // 服务端回传后填充（当前缺口）
  readonly retryable: boolean;
}

// 子类
TeavenAuthError          // 401
TeavenForbiddenError     // 403
TeavenNotFoundError      // 404
TeavenValidationError    // 400
TeavenRateLimitError     // 429（含 retryAfterMs?）
TeavenMaintenanceError   // 503 + error === 'maintenance_mode'
TeavenServerError        // 5xx
TeavenNetworkError       // fetch 抛错 / DNS / 连接重置
TeavenTimeoutError       // 本地超时或 AbortSignal
TeavenConfigError        // 本地参数错误（如 baseUrl 非法、allowBrowser 未开）
```

映射规则（依据 §2.1 实测）：

| HTTP | 服务端 `error` 示例 | SDK 错误 | retryable |
|---|---|---|---|
| 400 | `to and subject are required` | `TeavenValidationError` | 否 |
| 401 | `Invalid or disabled API key` | `TeavenAuthError` | 否 |
| 403 | `Insufficient permissions` | `TeavenForbiddenError` | 否 |
| 404 | `Template 'X' not found` | `TeavenNotFoundError` | 否 |
| 429 | `Daily sending limit reached` | `TeavenRateLimitError` | 读操作是，发信否 |
| 500 | `No enabled email provider found` | `TeavenServerError` | 仅读操作 |
| 503 | `maintenance_mode` | `TeavenMaintenanceError` | 否（除非调用方要求等待） |

错误对象实现 `toJSON()`，方便日志序列化；`message` 中**不包含** API Key。

---

## 8. 重试与幂等策略

**默认重试矩阵**（可通过 `retry` 配置覆盖）：

| 操作类型 | 自动重试 | 依据 |
|---|---|---|
| GET（日志 / 模板 / 统计 / 通道） | ✅ 3 次，指数退避 + 抖动 | 天然幂等 |
| DELETE（删模板 / 删 Key） | ⚠️ 不自动重试 | 服务端未保证幂等语义 |
| POST/PUT 发信、验证码发送 | ❌ 不自动重试 | 服务端无 `Idempotency-Key`，重试 = 重复发信 |
| POST 验证码校验 | ❌ 不自动重试 | 失败会消耗尝试次数（5 次即废码） |
| 网络错误 | ✅ 仅当请求尚未发出（连接建立阶段失败） | 无法判断服务端是否已处理 |

**幂等键**：SDK 预留 `idempotencyKey?: string` 参数，一旦服务端支持 `Idempotency-Key` 头（见看板任务 `t-mv11r0m2-mr9hdm`），SDK 会自动为发信请求带上该头，并把发信 POST 加入可重试集合。在此之前，`send()` 的重试一律关闭并在文档中显著提示。

**并发保护**：`mail.send()` 内部不排队；如果调用方需要限速，提供可选的 `concurrency` 选项（默认关闭），用信号量控制同时在途请求数。

---

## 9. 配置与凭据安全

- 优先从环境变量读取：`TEAVEN_EMAIL_API_KEY`、`TEAVEN_EMAIL_BASE_URL`（Node 包提供 `TeavenEmail.fromEnv()`）。
- **绝不**把 API Key 写入日志、错误信息、`toJSON()`；日志中 Key 一律脱敏为 `sk_abc***`（与服务端 `src/index.ts` 的脱敏策略一致）。
- 浏览器模式必须显式 `allowBrowser: true`，且文档要求只使用**受限权限**（仅 `SEND_MAIL`）的短期 Key。
- 不在 SDK 内做 Key 的本地持久化。

---

## 10. 测试策略

| 层级 | 工具 | 覆盖 |
|---|---|---|
| 单元测试 | Vitest | 错误映射、重试退避、参数校验、URL 拼接、脱敏 |
| 契约测试 | Vitest + MSW（或手写 fetch stub） | 用服务端真实响应样例做断言，防止字段漂移 |
| 集成测试 | Vitest + `wrangler dev` 本地实例 | 打真实 Worker（本地 D1/KV），跑一遍发信→查日志链路 |
| 类型测试 | `tsd` / `expectTypeOf` | 公共 API 的类型不被破坏 |
| 示例冒烟 | examples 各跑一次 | 保证文档中的代码可运行 |

契约测试的 fixture 直接取自服务端源码中的响应构造（如 `src/routes/mail.ts`），并在服务端接口变更时同步更新——这要求两个仓库的 CI 能互相发现漂移，建议在 SDK 仓库放一份 `contracts/` 快照并在服务端 CI 中校验。

---

## 11. 构建与发布

- 构建：`tsup`（esbuild 封装，零配置产出 ESM+CJS+d.ts）。
- `package.json` `exports` 字段：

```jsonc
{
  "name": "@moruteaven/email-sdk",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./webhook": { "types": "./dist/webhook.d.ts", "import": "./dist/webhook.js" }
  },
  "engines": { "node": ">=18" },
  "sideEffects": false
}
```

- 版本管理：Changesets。**dev 预发布版只推 git 源码 + 私有渠道分发，不产生公开发行版**；仅正式版执行 `npm publish --access public`（GitHub Actions + `NPM_TOKEN`，只对正式 tag 触发）。
- 发布前门禁：`typecheck` + `test` + `build` + `attw`（Are The Types Wrong，校验 exports 类型解析）。
- 许可证：MIT（符合项目对第三方/自研包的许可要求）。

---

## 12. 版本与兼容策略

- 遵循 SemVer：`0.x` 阶段允许 minor 破坏性变更，但必须在 CHANGELOG 明确标注。
- 服务端 `/v1` 为稳定前缀；SDK 与服务端版本解耦，但维护一张"SDK 版本 ↔ 服务端契约"兼容表。
- 弃用流程：先加 `@deprecated` TSDoc + 运行时 `console.warn`，至少一个 minor 后再移除。

---

## 13. 里程碑

| 阶段 | 内容 | 交付物 |
|---|---|---|
| M0 | 仓库脚手架（pnpm workspace + tsconfig + vitest + changesets） | 可 `pnpm build` 的空包 |
| M1 | 核心：transport / 错误模型 / 重试 / `send` + `sendTemplate` | 可在 Node 发信的最小闭环 + 单元测试 |
| M2 | 资源补齐：verification / logs / templates / providers / apiKeys / webhooks / profile | 全量覆盖 `/v1` 公开端点 |
| M3 | `waitForDelivery` + 契约测试 + 三个 examples | 文档可照抄运行 |
| M4 | 打 `0.1.0-dev.1` 标签并推送 git 源码（**不发公开发行版**，仅私有渠道分发） | git tag + README + 私有 tarball |
| M5 | 服务端补齐幂等键 / Retry-After / X-Request-Id 后，SDK 启用发信重试 | `0.2.0` |

---

## 14. 风险与开放问题

1. **服务端缺口阻塞**：幂等键缺失使 SDK 无法安全重试发信，这是 M5 之前最大的体验缺口（已登记看板）。
2. ~~默认 baseUrl 未定~~ → **已定稿**：`https://mail.chenyande.com`（2026-10-09）。
3. **投递状态语义**：`pending` 可能是"队列中"也可能是"卡死"，SDK 的 `waitForDelivery` 超时阈值需要与队列重试策略（`default_max_retries` + 租约）对齐。
4. **npm scope 发布权限**：`@moruteaven` 仍需你提供发布 Token（并确认 2FA 策略）；正式版发布前必须先配好 `NPM_TOKEN`。
5. ~~是否公开开源~~ → **已定稿：公开开源**（MIT，2026-10-09）。SDK 仓库自带 README 与 LICENSE，不复用服务端仓库的安全审计内容。
6. **Webhook 校验包**：服务端签名为 `X-Webhook-Signature: sha256=<hex>`（`src/queue_processor.ts:227`，HMAC-SHA256 over body，无时间戳）。SDK 校验函数需要同时支持原始 body 的精确校验，文档要提醒"必须先拿 raw body 再 JSON.parse"。

---

## 15. 关联看板任务

| 任务 ID | 标题 | 关系 |
|---|---|---|
| `t-mv11kbqv-2kcdig` | 我计划设计一个sdk 用来给其它 | 本设计文档的载体任务 |
| `t-mv11r0m2-mr9hdm` | [API 缺口] 发信接口无幂等键（Idempotency-Key） | 阻塞 SDK 发信重试 |
| `t-mv11rhof-oy1u3z` | [API 缺口] 429 响应缺少 Retry-After | 影响 SDK 限流退避 |
| `t-mv11r8tp-o6j83l` | [可观测性] 响应未回传请求 ID | 影响 SDK 错误关联 |
---

## 16. 决策记录（ADR）

| 日期 | 决策 | 结论 |
|---|---|---|
| 2026-10-09 | 仓库形态 | **独立新仓库** `MoruTeaven/Teaven-Email-SDK`（非现有仓库子目录），pnpm workspace monorepo |
| 2026-10-09 | 默认 API 域名 | `https://mail.chenyande.com` |
| 2026-10-09 | 开源策略 | **公开开源**，MIT 许可 |
| 2026-10-09 | npm 包名 | `@moruteaven/email-sdk`（唯一 scope `@moruteaven`） |
| 2026-10-09 | 发信重试 | 服务端支持幂等键前，发信类 POST **一律不自动重试** |
