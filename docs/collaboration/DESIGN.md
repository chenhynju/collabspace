# CollabSpace 详细设计

> 版本：2026-11-21 ｜ 状态：当前实现基线
> 关联文档：[需求分析](REQUIREMENTS.md) ｜ [功能归档](FEATURE-ARCHIVE.md) ｜ [用户手册](USER-OPERATIONS-MANUAL.md) ｜ [ADR](ADR.md) ｜ [历史设计](archive/DESIGN-HISTORY-2026-11-21.md)

## 1. 架构总览

```text
浏览器（Next.js / React）
  ├─ REST /api/v1  ──────────────► NestJS API（鉴权、组织上下文、业务事务）
  ├─ /collab WebSocket ──────────► 独立协作服务（Yjs 房间、presence、durable ACK）
  └─ /office 编辑页 ─────────────► ONLYOFFICE 引擎（文件编辑权威）

NestJS API
  ├─ Prisma + PostgreSQL（业务事实源，FORCE RLS）
  ├─ Redis（IM 广播、缓存；可选降级）
  ├─ DeepSeek（助手 / Agent 模型规划）
  ├─ ElevenLabs（STT Scribe v2 / TTS multilingual v2）
  ├─ Resend（验证、邀请、项目邮件）
  └─ Outbox / OperLog / LoginLog（异步与审计）

部署
  ├─ Vercel：Web 前端（collabspace.purelamp.uk）
  └─ 腾讯云 Docker Compose：API、collab WS、PostgreSQL、Redis、Office 引擎
```

设计原则：

1. **数据库是业务事实源**，实时内存与广播都不是最终事实。
2. **每个状态对象只有一个权威写入方**：正文归协作服务，ACL/版本/评论归 API，Office 细粒度编辑归引擎。
3. **失败关闭**：权限、版本、供应商未配置时明确拒绝，不静默回退、不伪造成功。
4. **证据优先**：PASSED / BLOCKED / NOT_RUN 必须可复核，不以 HTTP 200 代替业务完成。

## 2. 代码结构

| 目录 | 职责 |
| --- | --- |
| `apps/web/src/app` | Next.js App Router 页面；`(app)` 为主应用路由组，登录/注册/邀请独立 |
| `apps/web/src/components` | 文档、白板、IM、Office、AI、语音、设置等界面组件 |
| `apps/web/src/lib`、`store` | HTTP 客户端、协作连接、离线队列、通知订阅、Zustand 状态 |
| `apps/api/src/modules` | 29 个 NestJS 业务模块：auth、organizations、projects、documents、files、im、agent、voice 等 |
| `apps/api/src/common` | 守卫、trace_id、异常过滤、脱敏、权限工具 |
| `apps/api/prisma` | Prisma schema、迁移与 seed |
| `apps/collab` | 独立 WebSocket 协作服务（连接、房间、批量写入、ACK、广播） |
| `packages/collab-protocol` | 前后端共享帧定义、错误码、图形/形象目录 |
| `packages/collab-store` | 协作文档 SQL 读写、更新批次、快照、Office 支持 |
| `scripts`、`tests/browser` | 本地环境、验收脚本、Playwright 浏览器回归 |
| `deploy`、`terraform`、`.github/workflows` | 部署、基础设施、CI |
| `docs/collaboration`、`evidence/collaboration` | 文档与带日期的验收证据 |

## 3. 多租户与安全

### 3.1 请求链

1. `JwtAuthGuard` 全局校验 Bearer Token；公开路由显式标记。
2. 业务路由使用 `OrgContextGuard`：读取 `x-organization-id`，在 RLS 事务内反查 Membership，加载角色、菜单权限、数据范围。
3. Service 层通过 `prisma.withOrg` / `withOrgUser` 开事务；事务内先设置组织上下文，再执行业务查询。
4. 数据库对业务表启用 FORCE RLS；即使应用层漏判，也不能跨组织读写。
5. `TraceIdMiddleware` 为每个请求生成 trace_id，审计与错误响应共用。

### 3.2 关键约束

- 所有业务查询必须带服务端验证的 `organization_id`，不信任请求体/查询参数里的 orgId。
- 组织、成员、项目、文档状态在事务内复查；撤权与写入使用同一锁序。
- 最后一个有效 Owner 不能移除/降级。
- 审计记录 actor、资源、前后差异、trace_id；敏感字段脱敏，不记录正文和二进制。
- 密钥只在服务器环境变量中；前端只拿短期票据，不拿长期供应商密钥。

### 3.3 认证

- 邮箱注册 + 验证邮件；登录限流（IP+邮箱，5 次/5 分钟）。
- 密码重置走邮件 token；改密后旧登录态失效。
- Google / GitHub OAuth 代码已接；是否可用取决于环境是否配置对应 Client ID/Secret。

## 4. 数据模型

按职责分组（完整定义见 `apps/api/prisma/schema.prisma`）：

| 分组 | 主要模型 |
| --- | --- |
| 身份与组织 | `User`、`UserOAuth`、`Organization`、`Workspace`、`Membership`、`Role`、`Menu`、`Dept`、`Post` |
| 项目与任务 | `Project`、`Task`、`GroupMember`、`ResourceGrant` |
| 协作文档 | `CollabDocument`、`CollabGrant`、`CollabUpdate`、`CollabTicket`、`CollabThread`、`CollabReply`、`CollabVersion`、`CollabRestore`、`CollabImage` |
| 文件与 Office | `File`、`FileShare`、`Outbox` |
| IM 与通知 | `Conversation`、`ConversationMember`、`Message`、`MessageAttachment`、`Notice`、`NoticeRead` |
| 计费 | `Plan`、`Subscription`、`Entitlement`、`BillingEvent` |
| 审计与系统 | `OperLog`、`LoginLog`、`Config`、`DictType`、`DictData` |

模型统一带 `organizationId`；关系使用包含组织 ID 的复合键，避免跨组织引用。正文更新以 `CollabUpdate` 为持久化日志，`CollabVersion`/快照保存不可变状态。

## 5. 实时协作

### 5.1 连接与授权

- API 签发短期、单次使用的协作票据，绑定 user/org/project/doc/role/epoch/session/nonce。
- 浏览器建立 `/collab` WebSocket 后先发 auth 帧；未授权前不加载正文。
- 握手、重连、增量写入、同步读取、历史和评论都重新校验账号/组织/项目/文档状态与 ACL。
- 撤销权限时服务端主动断开或冻结；周期复校只作兜底，安全由数据库写入检查保证。

### 5.2 写入与 ACK

1. 客户端本地生成 Yjs 更新，先写入 IndexedDB pending，再发送。
2. 协作服务按文档串行排队，校验帧长、速率、schema 和权限。
3. 数据库事务写 `CollabUpdate`，分配单调 seq；同一 `updateId` 重试先核对 checksum。
4. 事务 commit 后才更新权威内存、发送 durable ACK 并广播。
5. 客户端收到 ACK 才清除 pending；只有“协议同步完成 + 本地 pending 全部 ACK + 无拒绝”才显示已保存到服务器。
6. DB 失败不 ACK、不广播；进程重启后从数据库重建。

### 5.3 离线、评论与版本

- IndexedDB key 含环境/账号/组织/docId/schemaVersion；先 hydration 再创建编辑器。
- 评论锚点使用 Yjs RelativePosition；原文删除后进入未定位列表。
- 命名版本保存不可变快照；恢复创建新 docId 的副本，不覆盖当前文档。
- 自动快照按成功编辑每分钟至多一份，可在时间轴浏览。

### 5.4 已知边界

- 当前为单 collab 实例；跨实例正文同步未验证。
- 单文档完整状态上限 5MiB，WS 单帧 256KiB。
- 已下载到离线设备的内容无法在撤权后“收回”，只能阻止继续上传。

## 6. 内容子系统

### 6.1 富文本与 Markdown

- Tiptap/ProseMirror + Yjs；标题、列表、任务、引用、链接、图片、LaTeX 公式。
- 图片上传/粘贴/拖入，每文档累计 20 张/20MB；图片继承文档 ACL。
- Markdown 以源码协作为主，支持导入 `.md`（≤200KB）与预览。

### 6.2 Office

- DOCX/XLSX/PPTX 通过 ONLYOFFICE 在线编辑；API 负责 ACL、文件版本、私有副本、PDF 导出。
- 引擎是细粒度编辑权威，应用是 ACL/版本权威；保存使用 generation/lease/epoch，防止旧回调覆盖新版本。
- 权限变更导致会话冻结，可从恢复候选找回未保存内容。
- 格式边界：复杂对象、宏、部分嵌套结构不宣称完整兼容。

### 6.3 白板与 Mermaid

- 自由画布：矩形、椭圆、便签、箭头、思维主题；拖拽、改字、连线、绑定连接线。
- 流程图/思维导图模板、自动布局；业务图表模板库覆盖高频场景。
- Mermaid 图形/源码/分屏三视图，源码为权威；支持导入追加与 SVG/PNG/源码导出。
- 单白板最多 500 个图元；任意 Mermaid 语法/坐标回写仍有限制。
- 箭头工具是“拖线”而不是插入箭头图形：从一个图元内部拖到另一个图元生成绑定连接线；从空白处拖动生成自由箭头（记录 `points.x1/y1/x2/y2`，不绑定图元）。
- 连接点有透明大命中区（约 14px）和可见小圆点；拖动时目标图元显示虚线高亮，落点使用 8–24 世界单位容差。
- 落点命中读取 Y.Doc 最新状态，而不是 React 渲染快照，保证“刚加完图元立刻连线”也能成功。
- 多选：Shift+点击切换成员，选择工具在空白处拖动框选，Ctrl/Cmd+A 全选图元；多选工具栏提供六向对齐、水平/垂直分布、批量复制/删除。
- 组拖：拖动任一已选图元，所有选中图元一起移动；松手时在一次 Yjs 事务内提交全部几何，连接线随两端图元移动，自由箭头不跟随。
- 智能参考线：移动或组拖时，将选区包围盒的左/中/右、上/中/下与其它非连接线图元的关键线比较，在 6 屏幕像素容差内吸附；拖动中显示 1 条粉色虚线，松手清除；可用“智能参考线”开关关闭。
- 层级顺序：图元按 `order` 升序绘制，连接线与自由箭头固定绘制在图元之上；置顶/置底/上移/下移在一次 Yjs 事务内重排图元 `order`。
- 白板 AI Agent：从已保存白板读取选区，生成受约束操作，用户确认后单次 Yjs 事务提交并等待 ACK。

### 6.4 白板 AI 操作协议

| 操作 | 参数 | 说明 |
| --- | --- | --- |
| `add` | `ref`, `type`, `text`, 可选 `x/y/w/h` | 新增矩形/椭圆/菱形/便签/文字/思维主题；缺坐标时按 3 列网格自动布局 |
| `note` | `ref`, `text`, `x`, `y` | 兼容旧协议的便签新增 |
| `update` | `ref`, `text` | 修改已有图元文字 |
| `move` | `ref`, `x`, `y` | 移动已有图元 |
| `connect` | `from`, `to` | 在两个图元之间创建绑定连接线，可引用本次新增的 `n` 引用 |

连接线数据有两种形态：绑定连接线使用 `binding.from/to`；自由箭头使用 `points.x1/y1/x2/y2`。两者都渲染箭头头部，但自由箭头不随图元移动。

单次最多 20 个操作；服务端读取选区、复查权限与版本，前端预览后由用户确认应用。AI 的 `connect` 只生成绑定连接线；自由箭头由用户手动拖出。AI 暂不支持删除、改颜色/线型。

## 7. AI 设计

### 7.1 两条能力线

| 能力 | 入口 | 行为 |
| --- | --- | --- |
| 协作助手 | `/assistant`、文档/Office 侧栏 | 摘要、行动项、翻译、写邮件；邮件确认后才发送 |
| AI 工作助理 | 顶栏“AI 助理”抽屉 | 规则规划 + DeepSeek 模型问答；写操作返回计划，用户确认后调用现有 REST |

### 7.2 受控写入

1. 用户在选中范围（段落/单元格/幻灯片/图元）上发起请求。
2. 服务端在组织事务与 RLS 上下文中读取可见事实，生成受约束操作。
3. 生成前后都复查权限；提案绑定资源、基础版本、操作范围、trace_id。
4. 用户确认后单次提交；幂等键保证网络重试不重复写入。
5. 目标版本已变化或权限被撤销时进入冲突/失效，不自动覆盖。
6. 应用记录审计：操作者、模型、基础版本、提交版本、动作摘要。

### 7.3 边界

- 模型只回答，不直接执行写操作；写操作必须经过确认。
- 未配置 `DEEPSEEK_API_KEY` 时保留规则能力与文本操作，不伪造模型结果。
- 白板 AI 单次最多 20 个操作；不支持删除、改颜色/线型或生成任意图形库形状；AI 连线只支持绑定图元。
- 不记录原始消息正文到普通日志；审计只保留必要摘要。

## 8. 语音与数字人

### 8.1 语音 Provider

`SPEECH_PROVIDER` 显式选择 `azure` / `volcengine` / `elevenlabs`，无自动回退：

- **ElevenLabs**（当前生产）：STT `scribe_v2`，TTS `eleven_multilingual_v2`，中英文 Voice ID 分别配置。
- **Azure**：global/china 显式端点，cloud/region 不匹配时失败关闭。
- **豆包**：按资源 ID 与音色配置。

任务模型：`/voice/jobs` 创建 STT/TTS 任务，按组织/用户/项目授权；单次 60 秒、4000 字；每小时 20 次、同时 1 个任务；失败不自动重试。

### 8.2 数字人

- 预设/卡通形象 + 基础口型预览：可用，但为第三方技术样例，不是 20 款定制成品。
- 私有照片/视频素材草稿：仅本人可见，≤20MB、最多 3 个、7 天过期，不外发、不训练。
- 真人数字人视频：`AvatarProvider` 目前为未配置实现，创建接口直接 503；不会显示虚假成功或可播放结果。
- 接入真实供应商时需要补：异步任务/回调、私有存储、授权与撤回、审计、费用与失败恢复。

## 9. IM、通知与邮件

- IM 使用 Socket.IO；Redis 可用时做广播/缓存，无 Redis 时降级单实例。
- 支持单聊/群聊、已读回执、输入中、图片/文件消息、语音听写。
- 个人通知不依赖先加入目标组织；通知中心聚合邀请、系统消息与业务提醒。
- 邮件通过 Resend：注册验证、邀请、项目邮件；合成域名只落日志供测试读取。
- 多项目回调验签、业务分流、持久化 outbox 与幂等，防止重复投递。

## 10. 搜索、审计与监控

- 全局搜索（`Ctrl/Cmd+K`）按组织与资源权限过滤页面、项目、文档、消息等结果。
- 审计：`OperLog` 记录 actor、资源、前后差异、trace_id；敏感字段脱敏。
- 登录日志：记录登录结果与异常，用于限流/风控排查。
- 监控：在线用户、服务资源、缓存、定时任务、数据库会话；健康检查 `/api/v1/health/ready`。

## 11. 前端设计

- Next.js App Router；主应用路由组 `(app)`；沉浸式文档/Office 编辑页隐藏顶栏。
- 顶栏保留高频目的地；更多入口在左侧抽屉；右侧 AI 助理抽屉；`Ctrl/Cmd+K` 搜索、`Ctrl/Cmd+J` 助理。
- Tailwind token 化：`slate/indigo/...` 映射 CSS 变量，支持“编辑风 / 经典浅色”双主题；主题在渲染前由内联脚本写入，避免 hydration 重置。
- 设置中心：主题、个人资料、语音与数字分身、成员/角色/部门/邀请、审计、通知、系统与监控。
- 可访问性：语义标题、aria 标签、键盘焦点管理、移动端阅读与基础编辑。
- 白板与文档工具栏统一使用 `Button`/圆角 token/indigo 激活态；基础图元工具使用 lucide 图标，避免空按钮。

## 12. 部署与运维

| 层 | 方案 |
| --- | --- |
| 前端 | Vercel，生产域名 `collabspace.purelamp.uk` |
| API | 腾讯云轻量服务器，Docker Compose，`collabspace-api-1` |
| 协作 WS | 独立容器/进程，`/collab` 路径 |
| 数据库 | PostgreSQL 16，FORCE RLS；不暴露宿主端口 |
| Redis | IM 广播/缓存，可选降级 |
| Office | 独立 ONLYOFFICE 引擎，API 受限访问 |
| 邮件 | Resend + webhook 路由 |
| 语音 | ElevenLabs（当前生产），密钥仅在服务器 env |

发布流程：构建/打包 → 上传 → 镜像构建 → 健康等待 → 线上验收 → evidence → 提交/标签。回滚保留 previous 镜像；数据库只做 additive 迁移。备份由发布脚本执行 `pg_dump` + uploads 打包，但**正式还原演练尚未做**。

## 13. 测试策略

| 层 | 方式 |
| --- | --- |
| API 单测/集成 | `node --test apps/api/tests/*.test.cjs`（含隔离 PostgreSQL 组） |
| Web 单测 | `node --test apps/web/tests/*.test.cjs` |
| 协作存储 | `pnpm test:collab`（真实 PG/WS） |
| 浏览器 E2E | Playwright，`tests/browser/*.spec.cjs`（55 个 spec 文件） |
| 线上验收 | 真实账号 + 服务器 Chrome；截图/JSON 存 evidence |
| 发布验证 | health、镜像一致性、RLS 在位、OOM/restarts |

测试数字是资产，不是通过率；报告必须区分 PASSED / BLOCKED / NOT_RUN，并附 commit、环境、命令和数据规模。

## 14. 关键取舍

| 取舍 | 选择 | 原因 |
| --- | --- | --- |
| 实时协作 | 自管 Yjs + 独立 WS | 需要公开持久化/恢复证据，已有后端权限基础 |
| 权威来源 | PostgreSQL | 进程重启、ACK 丢失、审计都需要可重建 |
| 权限 | 应用守卫 + RLS 双保险 | 单靠应用层或单靠数据库都不够 |
| 外部 AI/语音 | Provider 显式选择，无自动回退 | 数据地域、合规和费用必须可解释 |
| 支付 | 沙盒，入口隐藏 | 没有真实商户资质与资金授权 |
| 会议 | 代码保留，生产关闭 | 媒体稳定性与撤权验收未完成 |
| 数字人 | 草稿可用，真人生成未接 | 不伪造供应商能力 |

## 15. 相关文档

- [功能归档](FEATURE-ARCHIVE.md)：每个能力的当前状态、证据与限制。
- [需求分析](REQUIREMENTS.md)：用户、范围、BR、AT。
- [用户手册](USER-OPERATIONS-MANUAL.md)：使用与运维步骤。
- [ADR](ADR.md)：架构决策记录。
- [第三方服务](THIRD-PARTY-SERVICES.md)：供应商、环境变量与回调。
- [语音供应商选型](SPEECH-PROVIDER-SELECTION.md)：Azure/豆包/ElevenLabs 对比与生产配置。
- [Agent 与白板设计](AGENT-OFFICE-WHITEBOARD.md)：AI 受控写入白板/Office 的协议与验收。
