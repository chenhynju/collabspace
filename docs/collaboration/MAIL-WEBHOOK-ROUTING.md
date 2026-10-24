# 多项目邮件回调路由

2026-10-24：CollabSpace 入口已部署 r20261024-01，Resend 订阅enabled；真实发信与下游跨项目切换待验收，见证据。

P-MAIL / BR-MAIL：多个 Resend 项目、多个业务板块共用事件入口；禁止把发送回执当成用户完成邮箱验证、重置密码或接受邀请。

## 当前实现与边界

入口 `POST /api/v1/webhooks/resend` 使用原始请求体验证 Svix 签名及时间戳。没有 `RESEND_WEBHOOK_SECRET` 时返回503，不默认为验签通过。签名错误返回401。签名正确的相关事件入 PostgreSQL 后才返回200；数据库失败由 Resend 重试。原始正文、收件人、邮件正文和验证链接均不持久化。

邮件标签固定为 `app`、`module`。CollabSpace 自动发送 verification / password_reset / invitation 三种业务标签。notification 为默认类型。标签不需要在 Resend 注册。`email.sent` / delivered / delivery_delayed / failed / bounced / complained 是订阅范围。

CollabSpace 本地业务分流按 module 存入回执日志，状态 RECORDED；这是投递记录，不更改邀请或认证业务状态，不提供租户可查询接口，也不以标签中的组织字段授权。需要展示投递状态时，必须以本地保存的 provider email ID 查回业务资源及其权威 organization_id 后，在该组织上下文查询。

其他项目按固定配置路由到 HTTPS 接口。配置不能从事件提供的 URL 读取；禁止302跳转。每个下游独立HMAC签名、超时、去重、重试。事件元数据表为系统队列，不含租户业务数据，PUBLIC 无权限；业务表既有 RLS 不变。共享签名密钥仅用于服务间认证，不授予租户访问能力。

未配置路由、缺少标签、历史无标签邮件以 UNROUTED 留存，供人工核对，绝不猜测计费归属。重复事件ID且内容相同不重复投递；相同ID不同元数据返回409。已发送历史邮件不会自动补标签。

## 部署顺序

1. 数据库备份后，由管理员在独立 CollabSpace 数据库执行 `deploy/collabspace/2026-10-24-mail-webhook.sql`。运行角色为 collabspace_app；本地其他角色需调整最后的GRANT，不可提升应用角色权限。
2. 部署 API（无新增依赖），设置 RESEND_WEBHOOK_SECRET。发送 API Key 和 Signing Secret 是不同凭据。私密配置入口 `.test-runs/deploy/collabspace-mail.private.env` 已预留字段。
3. Resend 创建入口 `https://collabspace-api.purelamp.uk/api/v1/webhooks/resend`，订阅上述六类事件，复制其 Signing Secret 至服务器私密环境后重启本项目API。无需修改API Key或为每个module创建Resend订阅。
4. 下游接收接口先上线并验签、幂等，再配置 MAIL_WEBHOOK_ROUTES。切换期间保留旧回调；两种入口共享原始事件ID，下游共用持久去重记录。验收成功才停用旧订阅，不停用其他项目仍依赖的回调。
5. 用两个已获用户授权的邮箱验证 provider 接受、delivered/bounced 回执及业务归属。HTTP200仅证明回执接收，不证明用户读信。

配置示例（占位地址，实际部署前替换；密钥不入库）：

```env
MAIL_WEBHOOK_ROUTES={"billandcharge.billing_email":{"url":"https://billing.example.com/api/v1/billing/email/routed-webhook","secretEnv":"MAIL_ROUTE_BILLING_SECRET"},"portfolio.*":{"url":"https://portfolio.example.com/api/mail/routed-webhook","secretEnv":"MAIL_ROUTE_PORTFOLIO_SECRET"}}
MAIL_ROUTE_BILLING_SECRET=<至少32字符随机密钥>
MAIL_ROUTE_PORTFOLIO_SECRET=<另一个随机密钥>
```

密钥变量还需显式加入相应容器 environment。精确 app.module 优先，app.* 是兜底。CollabSpace 已知本地 module 在没有显式外转配置时本地记录；可通过 collabspace.invitation 等独立配置分流到不同接口。配置仅管理员可写；禁止把用户提交内容写入此配置。

## 其他项目的修改

- `mail-adapters/portfolio-tags.patch`：统一发信层增加 app=portfolio，调用方通过 module 指定 contact / verification 等用途；默认 notification。此补丁未创建作品集回执接口，不能先配置其外转地址。
- `mail-adapters/billandcharge-tags-filter.patch`：计费邮件标记 billandcharge.billing_email；已验签、无本地计费关联且明确属于 portfolio/CollabSpace 的事件确认并忽略；已有计费关联优先处理；未知或无标签回执保留重试逻辑。
- `mail-adapters/billandcharge-routed-receiver.patch`：新增内部HMAC验签入口，将最小事件映射到已有 EmailDeliveryService，沿用本地 provider receipt 反查租户、事件唯一约束和状态优先级。不复用 Resend 签名密钥。

以上为当前文件生成的待应用补丁；未修改、部署其他工作区。可在对应仓库 `git apply --ignore-space-change --check <补丁绝对路径>`，保留脏改动后应用、构建并运行该项目自己的测试。其他 Resend 项目同样改统一发送层，不能仅新增一个Key就认为回调隔离完成。

## 运维与验收

转发采用至少一次投递；下游必须先持久化且业务提交后返回2xx，原始eventId唯一去重。每次HTTP最多10秒，租约120秒，每批10条；尝试代数防止过期worker覆盖新结果。失败5分钟重试，12次后FAILED。UNROUTED/FAILED须人工监控，当前没有新增告警UI。修正路由后管理员按指定event_id设置route、status=PENDING、attempts=0、next_attempt_at=now()重放；不得批量猜测历史归属。原路由仍存在时配置变更可能改变后续目标，须走运维审查。

表需纳入备份，按合规保留期清理终态元数据；当前没有自动清理任务。不能称作跨项目生产验收完成，直到下游补丁、密钥、路由和真实邮件回执全部实测。

AT-MAIL：验签、篡改、过期签名、数据库失败不ACK、并发去重、ID冲突、module分流、未知业务保留、外转签名、目标失败重试、成功确认；证据见 evidence/collaboration/MAIL-ROUTING-2026-10-24.md。
