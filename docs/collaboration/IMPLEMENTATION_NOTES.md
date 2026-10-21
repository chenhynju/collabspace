# 实现取舍与运行说明

2026-10-21 Mermaid 优先：白板新增共享 Y.Text 源码、官方渲染器及图形/源码/分屏视图；源码为图表权威，沿用现有持久化 ACK、离线、ACL 与版本副本。新空白板默认 Mermaid，旧自由画布独立保留。兼容部署需先发布接受 `mermaid` 根的新后端，再发布前端；出现新源码或新图元后不能回退到拒绝这些数据的旧后端。详细契约和图形回写边界见 [MERMAID.md](MERMAID.md)。

本轮已上线并完成正式域名 7/7 业务验收；后端 r20261021-04，前端源提交 236de73。数据库/WS 本地 22/22、前端状态 4/4、CI 4/4。具体部署、证据及未验证边界见 [Mermaid 交付报告](../../evidence/collaboration/MERMAID-2026-10-21.md)。

2026-10-21 07:56 续做范围：实时协作为主线，多租户/资源权限是安全支撑。Toolkit 的成熟能力按缺口采用，避免替换现有组织与认证模型。订阅计费优先复用其他项目（已定位 D:/appspace/billandcharge）；OAuth/SSO 保留为近期后续路线，不作为本轮上线条件。运行门禁与评估证据见 ../../evidence/collaboration/CONTINUATION-2026-10-21.md。

2026-10-21 主线与新增入口、冲突合并证明见 [实时协作验收](../../evidence/collaboration/REALTIME-2026-10-21.md)。主线是多人文档、在线状态、评论、冲突合并；白板为扩展。

2026-10-20 后续部署进展见 [部署与线上验收状态](../../evidence/collaboration/DEPLOYMENT-2026-10-20.md)：用户已明确批准独立生产资源，Vercel 前端和腾讯云独立后端已上线，线上业务验收结果以部署报告为准；以下本地边界不作为线上通过证明。

CollabSpace 为独立私有仓库，origin 指向 https://github.com/chenhynju/collabspace。旧 CD、Hetzner、Terraform 部署工作流已移到 docs/legacy-workflows；本项目没有连接旧生产资源。

冲突、离线、权限与恢复的决策依据见 [ADR.md](ADR.md)，实际测试结果见 [本轮验收报告](../../evidence/collaboration/ACCEPTANCE-2026-10-20.md)。

## 与初始设计的具体取舍

- packages/collab-store 提供 HTTP 和同步服务共用的 PostgreSQL 事务授权；packages/collab-protocol 提供版本化帧白名单；apps/collab 为独立原生 WebSocket 服务。使用 Yjs 官方 state-vector / encodeStateAsUpdate / applyUpdate API 的差量交换，JSON/base64 envelope 携带 durable ACK；不声称兼容 stock y-websocket，也不自造 CRDT。
- 连接 ticket 采用数据库保存的 256 位随机不透明 token 的 SHA256，60 秒有效、事务单次消费。与设计中的签名 JWT ticket 相比，无需额外签名密钥，用户/组织/文档仍与记录绑定，ticket 仅在首帧传输。
- IndexedDB 自行使用单事务保存完整本地状态和 pending updateId 队列，以确保二者原子性；没有同时使用 y-indexeddb 的另一份存储。退出登录停止 provider 并删除账号缓存。没有 Service Worker，首次离线打开应用壳不在本轮范围。
- 同文档更新收集 10ms 后批量提交，事务中分别验证每位写入者；每条更新保留独立 updateId/seq/增量，整批只保存一次完整状态。只有 COMMIT 成功才发送 ACK 与差量广播，失败整批回滚。父级账号/组织/成员/项目共享锁与停用事务冲突，接收者在同事务内批量鉴权；权限结果不跨事务缓存。命名版本另存不可变完整状态，暂未自动压缩日志，写放大和存储增长仍是容量限制。
- 版本恢复使用幂等 UUID，创建全新 docId/Y.Doc 标识，仅恢复人初始可见；不复制旧评论锚点、不覆盖当前文档。
- 元数据 revision 随 JSON 请求体提交，等价执行乐观并发校验；尚未额外提供 HTTP If-Match header 适配。
- 评论/历史侧栏每 5 秒重新拉取，正文和 presence 用 WebSocket。评论草稿留在当前页面内存，断网时提交失败明确保留输入；不把其当成离线已提交评论。
- WebSocket 单条入站正文更新上限 256 KiB（JSON/base64 帧上限 360000 bytes），单文档完整状态上限 5 MiB。出站完整同步暂为单帧，没有分块；服务器慢消费者发送缓冲上限 1 MiB。5 MiB 文档并不等于所有同步/浏览器内存路径均已通过容量验证。
- 客户端每次仅发送一条已落盘 pending，间隔至少 60ms；5 秒没有 ACK 使用浏览器允许的应用关闭码 4000 重连，稳定 updateId 不变。IndexedDB 失败、过大编辑和撤权明确阻止继续上传并提示导出。
- 当前列表返回最近 100 条，评论和版本没有游标翻页；评论/历史每 5 秒拉取，尚未提供通知事件。这些是相对初始设计的明确缩减，后续规模化前补齐。
- 组织管理员仍需显式文档 ACL 才能读取协作文档，尚未提供带审计的应急接管入口。独立 collab 是单进程解码，尚无隔离 worker/CPU 配额；限帧、限流和队列约束不能替代恶意解码压力下的跨房间隔离证明。

## 实际 API 对照

所有路径位于 `/api/v1`，通过既有 JWT 与服务端验证的 `x-organization-id` 组织上下文；请求体中的 org 不作为授权依据。下表是实际控制器路径，初始 DESIGN 的嵌套路由与 If-Match 属于提案。

| 方法/路径 | 用途 |
| --- | --- |
| GET /documents?projectId=…；POST /documents | 当前项目可见文档/创建，POST 包含 projectId/title |
| GET/PATCH /documents/:id；POST /documents/:id/archive | 详情、带 revision 重命名、归档 |
| GET/PUT /documents/:id/grants | 权限列表/变更；最后一个有效 Owner 受保护 |
| POST /documents/:id/session-ticket | 单次短期 WS ticket 与地址 |
| GET/POST /documents/:id/threads | 评论列表/幂等创建 |
| PATCH /documents/:id/threads/:thread；POST /documents/:id/threads/:thread/replies | 带 revision 解决/重开、幂等回复 |
| GET/POST /documents/:id/versions | 不可变命名版本 |
| GET /documents/:id/versions/:version；POST /documents/:id/versions/:version/restore-copy | 只读快照、幂等恢复私有副本 |

正文仅走独立 WS 的版本化 Yjs 协议，REST 不接受完整正文替换。版本事务取得与正文相同的文档行锁，保存已提交 seq/state；有未 ACK 本地更新时 UI 禁止创建版本，不能把未提交本地编辑误标为版本内容。

## 本地开发

需要 Node >=20、pnpm、Windows/WSL 或 Docker 中的独立 Redis。不要复制源工程 .env。初次依赖安装会下载 Prisma 和 embedded-postgres 的对应平台引擎。

apps/api、apps/web、apps/collab 的 .env.example 仅为手动运行模板；local:up 直接设置隔离环境。collab 的原生 Node 入口读取进程环境，不自动加载 .env。迁移需要 DATABASE_ADMIN_URL，运行 API/WS 使用非特权 DATABASE_URL；部署时分别注入，不能把本地合成密码用于生产。

```powershell
pnpm install --frozen-lockfile
pnpm local:up
```

local:up 创建 .test-runs/collab-local/pgdata 的独立 PostgreSQL，127.0.0.1:5548/collabspace；只在首次写入合成 seed。Web/API/WS 默认端口 43120/43121/43122。它不自动安装 Redis；本地底座 Redis 配置是 6399，使用隔离实例，不共享其他项目的 Redis。

WSL 已有 redis-server 时可在单独终端运行：

```powershell
wsl -d Ubuntu-24.04 --exec sh -c 'exec /usr/bin/redis-server --bind 127.0.0.1 --port 6399 --save "" --appendonly no'
```

WSL localhost 转发取决于本机网络配置；可改成可达的独立 REDIS_URL。无 Redis 时既有 IM 降级单实例，OAuth 不可用，健康检查会报告 degraded；正文同步不依赖 Redis。Redis 故障恢复不等于已验证全部底座运维能力。

账号 owner@acme.dev、admin@acme.dev、member@acme.dev，合成密码 Passw0rd!。另有 Globex 合成组织用于隔离测试。打开 http://localhost:43120 登录，项目详情进入“协作文档”。

```powershell
pnpm --filter @teamspace/api build
pnpm --filter @teamspace/api test
pnpm --filter @teamspace/web test
pnpm test:collab
node node_modules/@playwright/test/cli.js test
node scripts/collab-load.cjs
```

test:collab 发现 local:up 生成的 config.json 时执行真实非特权 PG/WS 测试；未启动本地环境时会明确 skip DB 项。压测默认多房间 900 秒及热点 60 秒，不能把缩短时间的开发冒烟称作完整容量验证。

## 数据库与底座修复

继承副本的支付与 groups 代码先于其 Prisma schema 更新，导致 51 处编译错误；补齐 checkout/provider/externalId 字段、group 模型及 project visibility，注册已有 GroupsModule，并补上 accessibleProjectIds 请求类型和实际使用的 express 依赖。未修改原工程，未迁移生产数据库。

完整底座验收还发现项目/任务控制器及旧 Socket.IO 项目入口遗漏现有资源策略；已接入 ResourceAccessGuard、列表筛选与 socketAllowed，保留既有组织权限检查。独立本地 API 的 133 项业务检查通过，具体分项报告在 evidence/collaboration/foundation；这些是底座回归，不能计作协作文档的验收数量。

新协作表同时有 Prisma 模型和 packages/collab-store/schema.sql 加法迁移。初始化顺序：Prisma db push（仅开发新库）→ seed（仅首次）→ 创建非特权应用角色 → enable-rls.ts → collab:migrate。schema.sql 安装 FORCE RLS 与复合资源约束。现有有数据的部署需先生成/审阅正式迁移，禁止把 local:up 当生产初始化脚本。

回退应用时先停止新协作写入并保存数据库备份，再切回协议/表结构兼容的已验证应用版本；保留新增表与日志，不把 DROP TABLE 当应用回退。文档内容恢复使用历史私有副本，不覆盖当前协作 lineage。正式数据库备份还原、保留周期和跨版本回退未演练，仍属于发布门禁；本轮没有在生产执行迁移或回退。

## 演示路线

1. Owner 创建项目文档，通过共享权限给另一账号 Editor、客户 Commenter。
2. 独立浏览器共同编辑同段，观察在线名单和随原文移动的选区。
3. Editor 断网编辑，Owner 在线编辑；恢复网络后查看正文与两类保存状态。
4. 选中一段发表评论，另一个账号解决；删除原文后仍可找到未定位评论。
5. 创建“客户确认”版本，预览后恢复副本，验证原文没有被覆盖、客户默认看不到副本。
6. 撤销离线 Editor 权限后重连，验证不能上传草稿或读取新内容。

## 尚未宣称的能力

没有生产发布、真实客户数据、付费验收、完整备份恢复演练、跨地域 RTT 成绩或 Redis 双节点正文同步。容器文件做了工作区依赖适配，本机没有 Docker，容器构建与 TLS/反代验收须单独记录。
