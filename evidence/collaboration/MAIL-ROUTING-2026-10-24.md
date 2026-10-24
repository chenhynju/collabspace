# 邮件路由验证 — 2026-10-24

PASSED：API构建；专用4项测试（真实Svix签名、篡改/过期拒绝、数据库失败不确认、同项目按业务分流、非HTTPS拒绝、真实非特权PostgreSQL并发去重/ID冲突/UNROUTED保留/失败重试及HMAC转发成功）。命令：pnpm --filter @teamspace/api build；node .test-runs/test-mail-router.cjs（忽略目录的驱动从现有隔离配置加载数据库，执行 apps/api/tests/mail-webhook.test.cjs）。

已通过API创建CollabSpace独立Resend Webhook，初始disabled，线上验签验证后更新为enabled并重新GET确认。Signing Secret保存在本地忽略文件及服务器私密环境中，未打印密钥；未改已有订阅。

其他项目适配补丁已生成，尚未应用、未部署，也未声称通过其回归。生产端到端多项目分流、两收件人真实邮件验收尚未执行。无真实邮件外发。完整数据库恢复演练未执行。

## 线上证据

- 源码提交 be2c202ccb177163688d3b7c8ae3ceaa33f52f18 已非强制推送私有仓库。
- API release r20261024-01，image sha256:b9d78de5fd42b53b92f80ed21e9adc79365ab087777e304e5d241f4de09c8f92。仅覆盖编译后的四个mail模块文件，无新增依赖；前端与协作服务未切换。
- 执行独立系统邮件元数据表迁移；数据库备份1,064,582字节，上传备份157,645字节，备份目录可读；完整恢复未执行。回滚保留r20261023-02镜像、compose、环境快照，新增元数据表可保留。
- 公网入口合成签名验证：unsigned401、invitation200、duplicate200、conflict409、verification200。线上数据库实际查询 invitation / verification 各1条RECORDED，重复未新增，冲突未篡改业务板块。不是仅用HTTP状态验收。
- API数据库/Redis健康，原协作WS ready。线上 EMAIL_PROVIDER仍为console，Signing Secret已加载。尚未启用真实发送，以免其他项目兼容过滤上线前造成无效重试。
- API完整回归28项：24通过、4跳过。专用真实PG路由测试4/4；真实发送层自动标签测试包含在API回归中。
- 三个跨项目补丁已在对应当前工作区通过 `git apply --ignore-space-change --check`（Windows CRLF）。仅适用性检查，不等于该项目构建、测试或生产验收。尚未应用；用户授权问题已提交，待答复。
