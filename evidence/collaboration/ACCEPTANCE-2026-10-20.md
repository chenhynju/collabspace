# CollabSpace 本地验收 — 2026-10-20

本轮于北京时间 07:37 后继续。基础 HEAD b6a80b90e58b671975f0afcf4c379dc8365fab85，保留中断前工作树，不修改源 F-U01。origin 为用户授权的私有 chenhynju/collabspace；本地与实时远端 HEAD 在续做时一致。最终代码对应本报告所在提交，源码摘要另见 source-manifest.json。

## 环境与命令

Windows、Node 22、Next 14、Edge headless；独立本地 PostgreSQL 18.4（5548），应用角色非超级用户且无 BYPASSRLS；WS 43122/API 43121/Web 43120。Redis 7 为 WSL 独立 6399 实例。全部账号/数据为合成数据。本轮没有生产部署或凭据/生产数据修改。

| 检查 | 状态 | 证据与边界 |
| --- | --- | --- |
| API 完整构建 | PASSED | apps/api 中 `node node_modules/@nestjs/cli/bin/nest.js build` |
| 支付底座单元回归 | PASSED 17/17 | apps/api 中 `node --test tests/*.test.cjs`；支付服务替身，不是实时付款 |
| 前端租户状态回归 | PASSED 2/2 | `node --test apps/web/tests/*.test.cjs` |
| 协作/真实 PG/WS 回归 | PASSED 9/9 | `node scripts/test-collab.cjs`；没有跳过 |
| Windows 前端完整构建 | PASSED | 独立 NEXT_DIST_DIR=.next-verification；34 个页面完成，只有继承 IM 的 img 提示 |
| 底座完整业务验收 | PASSED 133/133 | `node scripts/test-foundation.cjs`，独立 API 43123；33 租户/交付 +24 IM +50 系统 +26 分组/支付；报告见 foundation/ |
| 最终统一浏览器回归 | PASSED 4/4 | browser-results.json；三账号编辑/恢复副本、在线去重/孤立评论、丢 ACK、离线关闭重开；冻结页面源码及最终 API 组合 |
| ACK 丢失重连 | PASSED | 故意丢弃一次 durable ACK，5 秒超时重连，同 updateId 只存在一条数据库记录；刷新后正文正确 |
| 逐字离线编辑/关闭再打开 | PASSED | browser-offline-results.json：真实断网 600 秒、逐字编辑、关闭重开本地恢复、重连与刷新后正文保留；耗时约 10.5 分钟 |
| 多标签在线与孤立评论 | PASSED | browser-presence-results.json；按用户去重、断线退场、删除原文后评论可见且刷新保留 |
| 完整容量基准 | BLOCKED：未全面达标 | 两次完整多房间测试远端 p95 均超 300ms；截止无未 ACK 更新。最终热点结果见下文 |
| GitHub CI | PASSED 4/4 jobs | 源码提交 0bbedc191c7d0adc0ae6a801440efe1a9634d86a；Lint/构建/测试、真实 PG 业务验收、hadolint、Terraform 静态验证均成功，ci-results.json 保存实际结果 |
| Docker 构建与运行 | NOT_RUN | 本机无 Docker；仅核对依赖/符号链接布局与构建上下文排除规则 |
| TLS/反代/备份演练/双节点 | NOT_RUN | 无生产授权，单节点实现不能推导跨节点可靠性 |

浏览器命令：`$env:OFFLINE_HOLD_SECONDS='600'; node node_modules/@playwright/test/cli.js test`。首次长测运行器挂起，保留 offline-interrupted-context.md 与 browser-interrupted-results.json；报告明确为 ENOENT，缺失共享产物目录中的 trace 文件，不能据当时页面已保存的快照宣称测试通过。独立重跑使用 `--output=.test-runs/browser-offline-final --reporter=list,json` 及独立 PLAYWRIGHT_JSON_OUTPUT_NAME，真实 600 秒流程已通过。最终统一浏览器回归另用 `.test-runs/browser-final` 目录，OFFLINE_HOLD_SECONDS=0，不冒充再次 10 分钟测试。

容量命令：`node scripts/collab-load.cjs`，完整默认时长没有缩短。load-development-workload.json 为前端构建、浏览器、API/底座回归同时进行时的完整报告：多房间 34100/34100 ACK，ACK p95 404.26ms、远端 p95 404.42ms，未达远端 <300ms；热点 2360/2360 ACK，ACK p95 119.31ms、远端 p95 119.18ms，达标。两者错误为 0。构建与回归结束后另跑完整基准，结果写入 load-results.json，原失败成绩保留。

第二轮完整多房间：34220/34220 ACK、错误 0，ACK p95 431.69ms、远端 p95 431.51ms，仍未达远端 <300ms。其间仍有本地服务、600 秒离线浏览器、少量协作回归及最终浏览器检查，不能称完全空闲主机。每客户端目标 2 次/秒，实际发送约 1.90 次/秒，脚本每轮处理后等待 500ms，未证明恒定精确 2Hz。不能把无 backlog 或 ACK 达标替代所有延迟门槛通过。

第二轮热点：2360/2360 ACK、错误 0，ACK p95 120.95ms、远端 p95 123.44ms，达标。正文最终编码大小与 PostgreSQL fsync/synchronous_commit 等设置见 load-document-sizes.json；未通过关闭持久化选项改善成绩。

容量客户端是 20 个 Node/Yjs/WebSocket 会话，使用同一个合成 Owner 身份，不是 20 个 Edge 页面或 20 个不同用户。指标中的 remote 是接收并 applyUpdate 完成时间，不是浏览器绘制完成时间；payloadBytes 是原始 Yjs 字节总数，不含 JSON/base64/TCP 开销。无模拟广域网 RTT，不能换算成生产网络容量或宣称 20 个不同账号的热点容量。

## 关键故障与修复

- ACK 超时曾调用浏览器不允许的主动关闭码 1011，导致回调抛错且无法重连。改用应用码 4000；真实浏览器丢 ACK 测试证明同 ID 重试、无重复持久化、刷新可恢复。
- 同文档更新收集 10ms 后单事务批量提交；每个账号仍独立授权，父级共享锁仍阻止撤权之后写入。测试覆盖 Viewer 混入、同批重复 ID、授权 Editor、deferred trigger 在 COMMIT 失败导致整批回滚。
- Fan-out 从“每位接收者重建全文并单独开事务”改为事务中批量授权，提交后只广播已提交差量。presence 每房间批量检查；数据库暂时不可用不会被误报为永久撤权。
- restore-copy 的历史失败点是接口 201 后页面未完成跳转。本轮稳定源码下完整三账号流程已通过实际跳转、正文与默认私有权限断言。未建立唯一根因，不能把历史 HMR、过载或 Redis ECONNRESET 认定为同一个已修复故障。
- webpack 将 Tiptap 和 provider 的 yjs 统一到相同模块入口。最新浏览器流程没有 pageerror；此项不等于所有第三方控制台警告已穷举消除。
- 底座完整验收暴露受限项目权限策略未接入项目/任务控制器与旧 Socket.IO 项目入口。补上 ResourceAccessGuard、列表过滤与 socketAllowed/周期复校后，隐藏、读取、只读写入拒绝、撤权与归档单元测试全部通过。文档仍使用独立 Store 授权，不依赖旧 Socket.IO。
- 最后 Owner 检查计入父项目可访问性；停用或无父项目权限的 grant 不能作为替代 Owner，但允许移除这些失效 grant。新增边界断言已通过。审计补齐结构化 before/after，记录权限角色、revision、状态及版本/恢复 ID，标题仅记摘要，不写正文/评论/ticket。

## AT 覆盖与剩余门槛

AT01/08：非特权 PostgreSQL RLS、跨组织、文档 ACL、受限项目、父级撤权锁、Viewer 伪造更新均有测试。AT02：三账号可见编辑和核心乱序/重复合并、Undo 保留远端编辑；真实中文系统 IME 尚未人工验收。AT03：每会话光标与按用户去重；多标签与断线 30 秒内退场已通过，复杂选区移动仍需扩展实机验收。AT04/05：短离线双人合并、600 秒草稿持久化关闭重开及离线撤权分别通过；尚未把“持有 600 秒”与“另一人持续在线编辑”组合为同一个长时用例。AT06：选区评论、解决、幂等、相对锚点及删除原文后评论保留均有测试。AT07：预览只读、恢复副本、新 CRDT 身份及默认私有有核心/PG/浏览器证据。AT09：ACK 后强杀重启、提交失败不 ACK、丢 ACK 重试均有证据。AT10 见完整基准。AT11 覆盖非法/过大 envelope、数据库提交失败和进程重启；恶意高负载跨房间隔离、Redis 故障注入和完整运维告警仍未验收。

保留 load-baseline.json：旧 900 秒多房间 ACK p95 约 323531ms、截止未确认 12226 条；旧热点 p95 约 51920ms。ackLoss 是截止未确认数量，不能直接解释为持久化数据丢失。load-short-20261020.json 记录优化后短测，不能代替完整基准，远端 p95 仍略超 300ms 目标。

当前明确限制：单节点、每批完整状态快照写放大、日志未压缩、入站更新 256KiB、出站完整同步未分块、列表限最近 100 条、评论/历史 5 秒轮询、无离线首次加载页面壳。原生 IME、移动端/读屏、最大文档规模和 M4 发布门禁没有用自动测试结果替代。

交付判定：核心单节点业务功能已具备本地运行与回归证据，可提交；M3 的性能/恶意负载隔离/实机 UX 与 M4 运维发布尚未全部完成，不宣称完整 P0 或生产就绪。
