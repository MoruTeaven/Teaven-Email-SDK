# 基础示例

展示如何用 `@moruteaven/email` SDK 发送邮件。

## 运行

```bash
# 安装依赖
pnpm install

# 设置环境变量
export TEAVEN_EMAIL_API_KEY=sk_your_key_here
# 可选：自定义域名
export TEAVEN_EMAIL_BASE_URL=https://email.chenyande.com

# 运行
pnpm start
```

## 演示内容

1. 发送普通邮件
2. 发送模板邮件
3. 发送验证码
4. 校验验证码
5. 等待投递结果（轮询）
6. 查看发信统计
7. 创建模板
