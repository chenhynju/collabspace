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

## 两项目适配及真实邮件续验收

用户已明确授权两个项目回归后部署。billandcharge提交f23280dea6252698ef34c2eebf6bf5c6c9866655已推送原codex/plan-entitlements分支；API sandbox-mail-router-v8上线43.130.127.57，镜像sha256:c046c7d36a1896f0683bab7c07afbce4afdbdbbf06508f617a76bf1453466924。备份位于该项目backups/pre-mail-router-v8，数据库目录已校验，未跑迁移或真实支付，旧image/config保留。原有其他人的AGENTS/README/未跟踪备忘录均未纳入本次提交。

计费单元54/54。完整隔离PG/HTTP211/211：首次退信测试借用前序已取消邮件夹具而失败，已改独立SUCCEEDED夹具并保留原业务断言，重新在全新目录验收。线上原回调：已验签collabspace/portfolio未知邮件各201忽略，未分类未知邮件仍503重试；内部路由正确签名未知邮件503（通过鉴权后未找到本地关联），错误项目/过期签名401。

中央路由已配置 billandcharge.billing_email → https://billing-api.purelamp.uk/api/v1/billing/email/routed-webhook。重放历史已确认送达的沙箱计费邮件，保留原事件ID和时间；中央队列一次尝试后FORWARDED，下游沿用既有事件ID幂等，不新增支付或改变账单权益。这是合成签名重放的网络验收，不是新的供应商投递事件。

CollabSpace真实发信已启用。启用前确认仅有1条SIMULATED历史任务，无PENDING/RETRY/SENDING，不重放历史演示邮件。用户指定的chenhynju@gmail.com、chenhuanyu@purelamp.cn各发送一封明确标记上线验收、无需认证操作的邮件，稳定幂等键防重发。两封email.sent和email.delivered均经真实Resend签名回调入库，app=collabspace/module=notification；未声称用户已经阅读、接受邀请或验证邮箱。

作品集提交41c43ded6438860eff75b667c7b841b41d5549e2已推送main；测试43/43、TypeScript通过。已核实本地旧项目名portfolio-site-384e与现purelampsite同一projectId，不重建项目。干净commit归档部署dpl_DPjYqXXMRgZsaA4h5HPxfBUvhNSp，单次构建配置跳过数据库迁移。Vercel API返回BLOCKED/STAGED，reason=project paused，project paused=true；尚未发布新版本，正式域名仍指向原部署dpl_8jgDRD2y7uSrAy6a8qVz3b1TTTp4。已向用户请求恢复项目服务，未更改套餐/预算或绕过暂停。作品集尚无回执消费者接口，其事件UNROUTED留存，不配置虚假下游地址。

## 作品集最终发布

用户授权恢复服务后，通过官方unpause接口确认paused=false。原BLOCKED部署保留为失败证据，重新提交相同已测试归档：dpl_3UWXQHW2cfuczwPrCpVFBWVkUH9j / https://purelampsite-cn01cdpia-purelamp.vercel.app，完整构建READY；无数据库迁移。已promote到www.purelamp.uk，线上真实Edge浏览器/en、/zh及/api/auth/providers均200，主内容和标题正常。没有通过作品集额外发送真实邮件；标签由43项定向回归及此次实际部署证明，不声称作品集新增了回执状态界面。原生产部署保留供回滚；套餐和预算未修改。
