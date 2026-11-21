# CollabSpace 开发者导读

在 VS Code 中打开仓库根目录。这里是一个 pnpm monorepo，包含浏览器前端、业务 API 和独立的编辑同步服务。部分包仍沿用 `@teamspace/*` 名称，搜索命令和依赖时也要搜这个前缀。

当前基线文档：[需求分析](REQUIREMENTS.md) ｜ [详细设计](DESIGN.md) ｜ [功能归档](FEATURE-ARCHIVE.md) ｜ [用户手册](USER-OPERATIONS-MANUAL.md) ｜ [文档索引](README.md)。历史状态与交接文档在 [archive/](archive/)，不要拿它们当当前验收依据。

## 目录地图

| 目录 | 负责什么 |
| --- | --- |
| `apps/web/src/app` | Next.js 页面和路由。`(app)` 是主应用路由组，括号不出现在 URL 中。登录、注册和邀请有独立入口。 |
| `apps/web/src/components` | 富文本、白板、IM、会议、语音、数字人等界面组件。 |
| `apps/web/src/lib`、`store` | HTTP 客户端、协作连接、离线队列、通知订阅，以及前端共享状态。 |
| `apps/api/src/modules` | NestJS 业务模块。按功能找 `*.controller.ts` 的 HTTP 入口、`*.service.ts` 的逻辑和 `dto/` 的输入约束。项目、文档、成员、邀请、账单和消息都在这里。 |
| `apps/api/src/common`、`prisma` | API 内的守卫、中间件、日志和数据库访问基础设施。业务数据库模型在 `apps/api/prisma/schema.prisma`。 |
| `apps/collab` | 独立 WebSocket 服务。`src/server.cjs` 处理连接、房间、在线状态、更新批次、持久化确认和广播。 |
| `packages/collab-protocol` | 前后端共享的认证和消息帧定义，以及图形、形象目录。修改消息结构时同时检查生产者和消费者。 |
| `packages/collab-store` | 协作文档 PostgreSQL 读写、更新批次、快照、Office 文件支持。目录中的 SQL 与 API 的 Prisma schema 一起构成数据库契约。 |
| `scripts`、`tests` | 本地环境、测试和交付辅助脚本。跨服务浏览器测试在 `tests/browser`，各包也有自己的测试目录。 |
| `deploy`、`terraform`、`.github/workflows` | 发布与回滚、基础设施配置和 CI。历史版本脚本保留当时的版本和校验值。 |
| `docs/collaboration`、`evidence/collaboration` | 产品设计、运维手册和带日期的验收证据。运行输出和本地一次性环境位于 `.test-runs`。 |

## 从需求找到代码

- **改页面或按钮。** 先在 `apps/web/src/app` 找对应路由，再找 `components` 和 `lib/api.ts`。沿方法或请求路径查到 NestJS controller。最后核对 API 守卫和数据查询中的组织范围。
- **查编辑丢失或同步卡住。** 从 `apps/web/src/lib/document-provider.ts` 查本地 `pending`、重连和 ACK，再到 `apps/collab/src/server.cjs` 查批量写入和广播，最后看 `packages/collab-store/index.cjs` 的 `updateBatch`。收到持久化 ACK 后客户端才应移除待发更新。检查重连时是否沿用原 `updateId`。
- **改文档权限或版本。** 从 `apps/api/src/modules/documents` 追到协作存储。验证组织、文档及用户三者的边界，并考虑连接已建立时撤权的场景。相关契约见[详细设计](DESIGN.md)和[快照时间轴](SNAPSHOT-TIMELINE.md)。
- **查邀请和消息。** 分别从 `invitations`、`im` 和 `notifications` 模块进入。编辑同步和消息通知走不同入口，断点应下在对应服务。

## 本地运行和验证

按[运维手册的本地开发章节](USER-OPERATIONS-MANUAL.md)准备本地依赖。`pnpm install --frozen-lockfile` 安装依赖。`pnpm local:up` 启动隔离环境，默认 Web 为 `43120`、API 为 `43121`、编辑 WebSocket 为 `43122`。本地 Redis 的配置以启动脚本为准。

```text
pnpm --filter @teamspace/api lint
pnpm --filter @teamspace/web lint
pnpm --filter @teamspace/api test
pnpm --filter @teamspace/web test
pnpm test:collab
```

`pnpm test:collab` 中的数据库集成测试使用隔离环境配置。运行后检查跳过项。涉及页面、权限或同步的改动，还要验证对应的浏览器流程，尤其是断线重连和服务端拒绝。

## 文档与归档

- 完成一个功能并通过验收后，先在 [功能归档](FEATURE-ARCHIVE.md) 增加/更新一行，写清状态、证据和限制，再更新 README 的“当前状态”。
- 验收证据放在 `evidence/collaboration/`，文件名带日期；不要只写“已测试”。
- 新架构决策追加到 [ADR](ADR.md)；时点状态、交接、WIP 文档完成使命后移入 [archive/](archive/)。
- 权限、资金、外发、供应商调用必须明确“已验证 / 未验证 / 不可用”，不用模糊措辞。

## 源码规范

使用根目录的 Prettier 配置，统一为两个空格缩进、双引号、分号、LF 和 100 列换行参考宽度。VS Code 安装 Prettier 扩展后可用 **Format Document**。命令行可用 `npx --yes prettier@3.6.2 --write <文件>`，CI 的 ESLint 和类型检查继续分别检查代码规则和类型。

一行表达只承担一个易读的步骤。遇到多层回调、复合条件或长 JSX，优先换行、使用能说明用途的本地变量，并按职责拆分确实可以独立验证的单元。注释用于解释权限、事务、重试和跨服务约定的原因。格式整理与行为变更分开审阅。
