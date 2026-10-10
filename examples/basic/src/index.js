/**
 * Teaven Email SDK — 基础示例
 *
 * 运行前设置环境变量：
 *   export TEAVEN_EMAIL_API_KEY=sk_your_key_here
 *   export TEAVEN_EMAIL_BASE_URL=https://email.chenyande.com  # 可选
 *
 * 然后执行：
 *   node src/index.js
 */
import { fromEnv } from '@moruteaven/email';

const mail = fromEnv();

// ── 1. 发送普通邮件 ──────────────────────────────
async function sendPlain() {
  const result = await mail.send({
    to: 'user@example.com',
    subject: '欢迎使用 Teaven Email',
    html: '<h1>你好！</h1><p>这是一封测试邮件。</p>',
    text: '你好！这是一封测试邮件。',
    category: 'SYSTEM',
  });
  console.log('已排队：mailId=%s, status=%s', result.mailId, result.status);
  return result;
}

// ── 2. 发送模板邮件 ──────────────────────────────
async function sendTemplate() {
  const result = await mail.sendTemplate({
    template: 'WELCOME',
    to: 'user@example.com',
    variables: { name: '张三' },
  });
  console.log('模板邮件已排队：mailId=%s', result.mailId);
  return result;
}

// ── 3. 发送验证码 ─────────────────────────────────
async function sendCode() {
  const result = await mail.verification.send({
    template: 'VERIFY_CODE',
    to: 'user@example.com',
    sceneType: 'register',
    codeLength: 6,
    expireMinutes: 5,
  });
  console.log('验证码已发送：expiresIn=%s秒', result.expires_in);
  return result;
}

// ── 4. 校验验证码 ─────────────────────────────────
async function verifyCode() {
  const { valid, message } = await mail.verification.verify({
    email: 'user@example.com',
    code: '123456',
    sceneType: 'register',
  });
  console.log('验证结果：valid=%s, message=%s', valid, message);
  return valid;
}

// ── 5. 等待投递结果 ──────────────────────────────
async function waitDelivery(mailId) {
  const log = await mail.mail.waitForDelivery(mailId, { timeoutMs: 60_000 });
  console.log('投递状态：%s', log.status);
  return log;
}

// ── 6. 查看发信统计 ──────────────────────────────
async function showStats() {
  const stats = await mail.mail.getStats(7);
  for (const day of stats) {
    console.log('%s: 发送=%d, 成功=%d, 失败=%d', day.date, day.total_sent, day.total_delivered, day.total_failed);
  }
}

// ── 7. 创建模板 ──────────────────────────────────
async function createTemplate() {
  const tpl = await mail.templates.create({
    name: '欢迎邮件',
    subject: '欢迎，{{name}}！',
    html: '<h1>你好 {{name}}</h1><p>感谢注册。</p>',
    category: 'NOTIFY',
  });
  console.log('模板已创建：code=%s', tpl.template_code);
  return tpl;
}

// ── 主流程 ────────────────────────────────────────
async function main() {
  console.log('=== Teaven Email SDK 示例 ===\n');

  try {
    // 选一个演示
    const result = await sendPlain();
    await waitDelivery(result.mailId);
  } catch (err) {
    if (err.code) {
      console.error('错误码：%s, 消息：%s', err.code, err.serverMessage || err.message);
    } else {
      console.error('未知错误：', err.message);
    }
  }

  console.log('\n完成。');
}

main();
