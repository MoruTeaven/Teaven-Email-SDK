/**
 * Teaven Email SDK — TypeScript 示例
 *
 * 展示完整的类型安全用法。
 *
 * 运行：
 *   export TEAVEN_EMAIL_API_KEY=sk_your_key
 *   pnpm start
 */
import { TeavenEmail, TeavenValidationError, TeavenRateLimitError } from '@moruteaven/email';
import type { SendResult, MailLog, Template } from '@moruteaven/email';

const client = new TeavenEmail({
  apiKey: process.env.TEAVEN_EMAIL_API_KEY!,
  // baseUrl 默认 https://email.chenyande.com
});

// ── 发送并等待投递 ───────────────────────────────
async function sendAndWait(): Promise<MailLog> {
  const result: SendResult = await client.client.mail.send({
    to: 'user@example.com',
    subject: '订单确认 #1027',
    html: '<p>您的订单已确认。</p>',
    category: 'NOTIFY',
  });

  console.log('已排队:', result.mailId);

  // 轮询直到投递完成或超时
  const log = await client.mail.waitForDelivery(result.mailId, {
    timeoutMs: 30_000,
    intervalMs: 2_000,
  });

  console.log('投递状态:', log.status);
  return log;
}

// ── 模板管理 ─────────────────────────────────────
async function setupTemplate(): Promise<Template> {
  // 创建模板
  const tpl = await client.templates.create({
    name: '订单确认',
    subject: '订单确认 #{{orderId}}',
    html: '<h1>订单 {{orderId}}</h1><p>总价: ¥{{amount}}</p>',
    textContent: '订单 {{orderId}}，总价: ¥{{amount}}',
    category: 'NOTIFY',
  });

  // 预览渲染效果
  const preview = await client.templates.preview(tpl.template_code, {
    orderId: '1027',
    amount: '299.00',
  });
  console.log('预览:', preview.subject);

  return tpl;
}

// ── 错误处理 ─────────────────────────────────────
async function safeSend(): Promise<void> {
  try {
    await client.client.mail.send({
      to: 'user@example.com',
      subject: '测试',
      html: '<p>测试</p>',
    });
  } catch (err) {
    if (err instanceof TeavenValidationError) {
      // 400 — 请求参数有误
      console.error('参数错误:', err.serverMessage);
    } else if (err instanceof TeavenRateLimitError) {
      // 429 — 超出配额或频率限制
      console.error('频率限制, 建议 %dms 后重试', err.retryAfterMs);
    } else {
      throw err;
    }
  }
}

// ── 主流程 ───────────────────────────────────────
async function main(): Promise<void> {
  console.log('=== TypeScript 示例 ===\n');

  try {
    await setupTemplate();
    await sendAndWait();
  } catch (err) {
    console.error('错误:', err instanceof Error ? err.message : String(err));
  }

  console.log('\n完成。');
}

main();
