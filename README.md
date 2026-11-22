# CollabSpace

**多租户协作空间：文档、Office、白板、IM、AI 与语音，在同一条权限与审计链路上。**

生产演示：https://collabspace.purelamp.uk ｜ 演示账号请向作者索取（不在仓库保存密码）

---

## 这是什么

CollabSpace 是一个可运行的 B2B 协作 SaaS 作品集项目。它把项目团队常用的几件事放进同一个组织/工作区/项目结构：

- 多人实时编辑富文本、Markdown、白板与 Office 文件；
- 白板基础图元、箭头拖线、多选/框选、智能参考线、层级顺序、图元评论/评审、对齐分布、AI 生成流程图；分组/锁定/旋转、Frame/图层、自动布局、形状库搜索、PNG/PDF 导出与 `.drawio` 导入导出；
- 评论、版本、自动快照、断线重连与离线续写；
- 单聊/群聊、已读、输入中、附件与语音听写；
- 协作助手与 AI 工作助理，写操作必须“计划 → 确认 → 应用”；
- 多租户隔离、文档 ACL、最后一个 Owner 保护、审计与监控；
- 生产部署、健康检查、发布/回滚与可复核的验收证据。

它不是一个“功能堆满首页”的演示，而是一个强调**失败关闭、权限边界和可追溯交付**的工程项目。

## 这个项目展示了什么

| 能力 | 具体体现 |
| --- | --- |
| 多租户安全 | 服务端组织上下文 + PostgreSQL FORCE RLS + 资源 ACL + 撤权竞态检查 |
| 实时协作 | 自管 Yjs + 独立 WebSocket 服务 + durable ACK + 离线 pending + 快照 |
| 复杂内容 | 富文本/Markdown/Office/白板/Mermaid 共用权限、版本与实时体系 |
| AI 受控写入 | 规则规划 + DeepSeek；写操作生成计划，确认后单次提交，幂等 + 审计 |
| 语音 | ElevenLabs Scribe v2 听写 + multilingual v2 合成，失败不自动重试 |
| 交付工程 | 生产部署、健康检查、发布/回滚、55 个浏览器 spec、420+ 份 evidence |

## 功能概览

- **项目空间**：组织、工作区、项目、成员、部门、岗位、角色、邀请。
- **协作内容**：富文本、Markdown、白板/Mermaid、Word/Excel/PowerPoint；白板支持多选、框选、智能参考线、层级顺序、图元评论/评审、对齐分布和组拖；支持导出 PNG(2x)/PDF、持久分组/锁定/旋转、Frame/图层、自动布局、形状库搜索与 `.drawio` 导入导出；Mermaid 源码/图元用开关切换。
- **协作能力**：实时编辑、在线成员、评论、@提及与站内通知、命名版本、自动快照、恢复为副本、公开只读分享（到期/撤销）。
- **消息**：单聊/群聊、已读、输入中、图片/文件、语音听写。
- **AI**：摘要、行动项、翻译、写邮件、项目问答、受控改文档/白板；白板支持新增图元、改字、移动、连线和自动布局。
- **治理**：审计、登录日志、公告、系统配置、监控、套餐沙盒。
- **体验**：顶栏 + 抽屉导航、全局搜索（`Ctrl/Cmd+K`）、AI 助理（`Ctrl/Cmd+J`）、双主题、个人资料。

## 技术栈

- **前端**：Next.js 14 App Router、React 18、TypeScript、Tailwind CSS、Zustand、Tiptap/ProseMirror、Yjs。
- **后端**：NestJS 10、Prisma、PostgreSQL 16（FORCE RLS）、Redis、Socket.IO。
- **协作**：独立 Node WebSocket 服务 + Yjs CRDT + 自定义 durable ACK。
- **Office**：ONLYOFFICE 引擎，API 负责 ACL/版本/PDF/私有副本。
- **AI/语音/邮件**：DeepSeek、ElevenLabs、Resend。
- **部署**：Vercel（前端）+ 腾讯云 Docker Compose（API/WS/DB/Redis/Office）。

## 仓库结构

```text
apps/
  web/       Next.js 前端（48 个页面）
  api/       NestJS API（29 个业务模块）
  collab/    独立 WebSocket 协作服务
packages/
  collab-protocol/  共享帧定义、错误码、目录
  collab-store/     协作文档 SQL、快照、Office 存储
docs/collaboration/ 需求、设计、功能归档、用户手册、专项设计
evidence/collaboration/ 带日期的验收证据与截图
tests/browser/      Playwright 浏览器回归（55 个 spec 文件）
deploy/ terraform/  部署与基础设施
```

## 快速开始

```powershell
pnpm install --frozen-lockfile
pnpm local:up
```

默认 Web `43120`、API `43121`、协作 WS `43122`。本地合成账号：

```text
owner@acme.dev / admin@acme.dev / member@acme.dev
密码见 .test-runs/collab-local/config.json（仅本地，勿用于生产）
```

测试：

```text
pnpm --filter @teamspace/api test
pnpm --filter @teamspace/web test
pnpm test:collab
node node_modules/@playwright/test/cli.js test
```

## 文档

| 文档 | 内容 |
| --- | --- |
| [需求分析](docs/collaboration/REQUIREMENTS.md) | 用户、场景、范围、BR、AT、指标 |
| [详细设计](docs/collaboration/DESIGN.md) | 架构、模块、数据、安全、实时、AI、语音、部署 |
| [功能归档](docs/collaboration/FEATURE-ARCHIVE.md) | 已完成功能、状态、证据、限制、待办 |
| [用户手册](docs/collaboration/USER-OPERATIONS-MANUAL.md) | 上手、核心流程、管理、排障、演示路线 |
| [开发者导读](docs/collaboration/DEVELOPER-GUIDE.zh-CN.md) | 目录地图、从需求找代码、本地验证 |
| [ADR](docs/collaboration/ADR.md) | 关键架构决策 |
| [第三方服务](docs/collaboration/THIRD-PARTY-SERVICES.md) | 供应商、环境变量、回调 |
| [文档索引](docs/collaboration/README.md) | 全部现行文档与历史归档 |

## 当前状态

- 生产站点：https://collabspace.purelamp.uk
- 前端部署：`collabspace-ca5sq74m2-purelamp.vercel.app`（已别名）
- API 镜像：`collabspace-api:api-r20261121-11`
- 提交：`1cf06c8`；标签：`collabspace-20261122-review-comments`、`collabspace-20261122-smart-guides`、`collabspace-20261122-multiselect`、`collabspace-20261122-arrow`、`collabspace-20261122-docs`、`collabspace-20261121-board-ai`

### 已上线

文档/Markdown/白板/Mermaid/Office 协作、白板箭头拖线与 AI 生成流程图、评论、版本、快照、权限、IM、通知、邮件、搜索、AI 助手、ElevenLabs 语音、审计、监控、双主题、个人资料。

### 明确边界

- 支付仅沙盒，生产不展示收款入口。
- 会议代码保留，生产开关关闭（`MEETINGS_ENABLED=false`）。
- 真人数字人视频供应商未接入，只支持私有素材草稿；不会伪造成功或可播放结果。
- 实时正文为单 collab 实例，跨实例/跨地域未验证。
- 单文档 5MiB、WS 单帧 256KiB、白板 500 图元。
- 白板支持图元间绑定连接线和空白处自由箭头；自由箭头不绑定图元，AI 连线只支持绑定。AI 单次最多 20 个操作，不支持删除/改色/改线型。
- 多选对齐/复制只作用于图元；连接线和自由箭头不参与对齐，组拖时自由箭头不跟随。
- 智能参考线只吸附图元边缘与中心线，不做等间距提示；层级调整不改变连接线之间的叠放次序。
- 图元评论复用文档评论权限，图元删除后评论保留但不可定位；暂不支持 @提及与通知中心提醒。
- 语音为录音结束后 REST 识别/合成，不是流式字幕；无自动回退和自动重试。
- 备份还原演练尚未完成。

## 验收与证据

- 发布审查：[REVIEW-RELEASE-2026-10-30.md](evidence/collaboration/REVIEW-RELEASE-2026-10-30.md)
- 全量回归：[FULL-REGRESSION-2026-11-13.md](evidence/collaboration/FULL-REGRESSION-2026-11-13.md)
- 界面/AI/语音：[UI-REDESIGN-AGENT-2026-11-20.md](evidence/collaboration/UI-REDESIGN-AGENT-2026-11-20.md)
- ElevenLabs 生产验收：[voice-elevenlabs-online.json](evidence/collaboration/ui-editorial-2026-11-21/voice-elevenlabs-online.json)
- 白板交互与 AI 改图：[BOARD-AI-INTERACTION-2026-11-21.md](evidence/collaboration/BOARD-AI-INTERACTION-2026-11-21.md)
- 自由箭头与绑定箭头：[BOARD-ARROW-FREE-2026-11-22.md](evidence/collaboration/BOARD-ARROW-FREE-2026-11-22.md)
- 多选、框选、对齐与组拖：[BOARD-MULTI-SELECT-2026-11-22.md](evidence/collaboration/BOARD-MULTI-SELECT-2026-11-22.md)
- 智能参考线与层级顺序：[BOARD-SMART-GUIDES-2026-11-22.md](evidence/collaboration/BOARD-SMART-GUIDES-2026-11-22.md)
- Mermaid 开关视图与图元评论：[BOARD-REVIEW-COMMENTS-2026-11-22.md](evidence/collaboration/BOARD-REVIEW-COMMENTS-2026-11-22.md)

验收口径：PASSED / BLOCKED / NOT_RUN 必须可复核；不以 HTTP 200、模型流返回或广播 hash 代替业务完成。

## 作品集说明

这是个人独立完成的全栈项目，覆盖需求、设计、实现、测试、部署、线上排障和文档。面试演示建议只走一条主线：**多租户安全 → 实时协作 → AI 受控写入**；其余能力作为支撑，不逐页展示。详细脚本见用户手册第 9.7 节。

历史逐日需求、旧状态与交接文档已移入 [docs/collaboration/archive/](docs/collaboration/archive/)，保留追溯，不作为当前验收依据。
