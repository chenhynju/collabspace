# 邮件路由验证 — 2026-10-24

PASSED：API构建；专用4项测试（真实Svix签名、篡改/过期拒绝、数据库失败不确认、同项目按业务分流、非HTTPS拒绝、真实非特权PostgreSQL并发去重/ID冲突/UNROUTED保留/失败重试及HMAC转发成功）。命令：pnpm --filter @teamspace/api build；node .test-runs/test-mail-router.cjs（忽略目录的驱动从现有隔离配置加载数据库，执行 apps/api/tests/mail-webhook.test.cjs）。

已通过API创建CollabSpace独立Resend Webhook，请求初始disabled，Signing Secret保存在本地忽略文件中，未打印密钥；未改已有订阅。

其他项目适配补丁已生成，尚未应用、未部署，也未声称通过其回归。生产端到端多项目分流、两收件人真实邮件验收尚未执行。无真实邮件外发。完整数据库恢复演练未执行。
