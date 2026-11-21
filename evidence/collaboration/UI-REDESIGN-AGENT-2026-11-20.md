# CollabSpace 工作台重设计与 AI 工作助理验收（2026-11-20）

## 范围与设计取舍

- 彻底取消常驻左侧菜单栏，改为顶栏 + 左侧抽屉 + 右侧 AI 助理。
- 第一公民：概览、项目空间、协作空间、消息、附件、通知中心。
- 工作区与项目合并为一个「项目空间」入口，工作区 CRUD 在页面右侧面板完成；`/workspaces` 保留为兼容跳转。
- 组织、权限、审计、系统与监控收进 `/settings`，入口放在抽屉左下角身份信息下方。
- 沉浸式文档和 Office 编辑页不显示顶栏，改用左下角浮动菜单与 AI 按钮。
- 交互参考飞书/钉钉的工作台、Codex/Claude 的对话式操作；不复制其品牌或视觉资产。
- Figma MCP 未连接，且未提供本次目标设计稿，因此没有做 Figma 1:1 还原；沿用仓库现有 Tailwind、slate/indigo 色板、lucide 图标和共享 `ui.tsx` 组件。

## 代码改动

| 区域 | 文件 |
| --- | --- |
| 应用壳层 | `apps/web/src/components/AppShell.tsx`、`NavDrawer.tsx`、`navigation.ts` |
| 抽屉与导航 | 删除 `Sidebar.tsx`；更新 `apps/web/src/app/(app)/layout.tsx` |
| 项目空间 | `apps/web/src/app/(app)/projects/page.tsx`；`workspaces/page.tsx` 改为跳转 |
| 设置中心 | 新增 `apps/web/src/app/(app)/settings/page.tsx` |
| 概览 | `apps/web/src/app/(app)/dashboard/page.tsx` |
| AI 工作助理 | 新增 `apps/web/src/components/AgentDock.tsx`；新增 `apps/api/src/modules/agent/` |
| 协作空间 | `apps/web/src/components/documents/CollaborationHub.tsx` 不再把已归档项目作为新建目标 |
| 样式 | `apps/web/src/app/globals.css` 抽屉/助理入场动画 |

## AI 工作助理

接口：

- `GET /api/v1/agent/capabilities`
- `POST /api/v1/agent/chat`

行为：

- 服务端在组织事务与 RLS 上下文中读取工作区、可访问项目、任务、成员、邀请和文件。
- 本地规则规划覆盖：列出工作区/项目/任务/成员/邀请/文件；新建、改名、启动、交付、归档、删除项目；工作区增删改；任务创建与状态更新；文档/白板创建并跳转；邀请；成员停用/恢复/移除；页面导航。
- 写操作只返回计划，不直接落库；用户在助理面板点击“确认执行”后，前端调用现有 REST 接口，沿用现有权限、状态机、审计和实时事件。
- 权限不足时返回明确拒绝，不返回可执行计划。
- 未命中规则时，若配置 `DEEPSEEK_API_KEY` 则使用只读问答；未配置时返回可用指令。模型只回答，不直接执行写操作。
- 审计动作 `agent:chat` 只记录工具名、规划来源和回复长度，不记录原始消息正文。

## 2026-11-20 补充：DeepSeek、语音输入与 Office

### DeepSeek 实际连通

服务端 `apps/api/.env` 已配置 `DEEPSEEK_API_KEY`，未写入前端或仓库。真实调用结果：

- 协作助手摘要：`POST /assistant/generate` 返回 201，约 1.6 秒，返回中文摘要、关键结论与风险，不是模拟结果。
- AI 助理模型规划：`POST /agent/chat`（非规则问题）返回 `source: "model"`，约 2.0 秒，基于当前项目快照给出本周建议。
- `/assistant/status` 返回 `ai: true`；`/agent/capabilities` 返回 `modelPlanning: true`。

### 语音输入

- AI 助理输入框新增麦克风按钮，使用浏览器 Web Speech API（Edge/Chrome）。
- 支持中文（`zh-CN`）、临时识别结果写入输入框、再次点击停止、发送前自动停止。
- 不支持时按钮禁用并提示改用键盘；权限拒绝、无语音、网络异常分别给出明确反馈。
- 浏览器验收已确认麦克风按钮存在；未在无麦克风的 CI 环境声称真实识别通过。

### Office 套件无法编辑的诊断

当前本地环境实测：

- `GET /api/v1/office/status` 返回 `{"configured":false,"storageReady":true,"provider":null}`。
- 数据库 `collab_office`、`collab_office_version`、`collab_office_lease` 均已存在。
- `apps/api/.env` 没有 `OFFICE_PUBLIC_URL`、`OFFICE_INTERNAL_URL`、`OFFICE_JWT_SECRET`、`OFFICE_CAPABILITY_SECRET`。
- WSL 内 Docker 可用，但没有 OnlyOffice DocumentServer 容器；且 WSL 访问 Windows API `192.168.100.1:43121` 被拒绝，容器回调当前无法闭环。
- 根因不是文档权限或 Office 数据表缺失，而是 **OnlyOffice 引擎与四项服务端配置均未就绪**。

已做改进：

- 新增 `GET /office/status`，返回引擎是否配置与存储是否就绪。
- 协作空间在未配置时显示明确提示，并禁用 Word/Excel/PowerPoint 新建入口；文档、白板与附件下载不受影响。
- 打开 Office 失败时，项目详情、附件页和编辑器显示可执行的配置提示，而不是笼统的“服务不可用”。
- `apps/api/.env.example` 增加 Office 配置模板。

启用步骤：

1. 使用 `deploy/collabspace/office-development.compose.yml` 启动固定摘要的 OnlyOffice DocumentServer，并确保 `OFFICE_JWT_SECRET` 与容器一致。
2. 在 `apps/api/.env` 配置 `OFFICE_PUBLIC_URL`、`OFFICE_INTERNAL_URL`、`OFFICE_JWT_SECRET`、`OFFICE_CAPABILITY_SECRET`，必要时配置 `OFFICE_CALLBACK_BASE`。
3. 保证 DocumentServer 容器能访问 API 的 `/api/v1/office/engine/*`；本机 WSL Docker 到 Windows API 需要防火墙入站规则，或把 API 与引擎放到同一 Docker/WSL 网络。
4. 重启 API 后确认 `/office/status` 的 `configured` 为 `true`。

诊断截图：[Office 未配置提示](ui-redesign-2026-11-20/office-unconfigured.png)。

## 2026-11-20 补充：Mermaid 编辑区重设计

- 去掉常驻说明段落，编辑器只保留“添加形状 / 连接 / 选择与修改”三步工具；详细说明收进默认折叠的“第一次用？”。
- 模板库未展开时只保留“浏览模板”按钮；底部状态缩为“字符数 · 可编辑”。
- 形状库仍支持点击添加和拖入画布；拖拽后写入 `%% collab-position`，测试已覆盖。
- 流程图与思维导图都可在“已选中”面板修改文字，按 Enter 保存；新增 `renameMindNode`、`deleteMindNode`，思维导图可改主题、加子主题、删除子树。
- 选择画布或列表中的形状后，属性面板自动滚入视野。
- Mermaid 语法错误只显示可理解的原因与行号，原始报错收进“查看原始错误”。
- 新增 AI 图表代理：输入文字或用浏览器语音输入要求，调用 `POST /documents/:id/agent/mermaid`，模型返回完整 Mermaid 源码；先预览，确认后才写入协作源码，并校验源码序号防止覆盖他人修改。
- 真实 DeepSeek 验收：空图表生成“提交→审批→通过发布/驳回回到提交”流程图，约 2.4 秒；UI 预览后应用成功。
- 竞品参考：交互密度参考飞书/钉钉的“工具优先”，AI 修改采用 Codex/Claude 的“先预览再应用”，不复制其视觉资产。

截图：[紧凑编辑区与思维导图改字](ui-redesign-2026-11-20/mermaid-ux-main.png)、[AI 生成并拖入形状](ui-redesign-2026-11-20/mermaid-agent-ui.png)。

新增/回归测试：

- `tests/browser/mermaid-ux.spec.cjs`：通过（流程图/思维导图改字、子主题、拖拽、AI 入口与语音按钮）。
- `tests/browser/business-diagrams.spec.cjs`：通过（共享属性、连线、模板、导入、导出）。
- `tests/browser/mermaid.spec.cjs`：通过（源码权威、离线、诊断、历史预览与恢复为副本）。

## 功能与行为验证

运行环境：Windows + Node 22.20.0 + pnpm 12.4.2；本地隔离环境 `collab-redesign`（Web 43120、API 43121、Collab 43122、PostgreSQL 5548）。Redis 未启动，WebSocket 按代码降级为单机模式。

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @teamspace/web exec tsc --noEmit` | 通过 |
| `pnpm --filter @teamspace/api lint` | 通过 |
| `pnpm --filter @teamspace/web test` | 31/31 通过 |
| `pnpm --filter @teamspace/api test` | 68 通过，8 跳过，0 失败 |
| `npx playwright test tests/browser/ui-redesign.spec.cjs` | 3/3 通过 |
| `npx playwright test tests/browser/ui-refresh.spec.cjs` | 通过 |
| `npx playwright test tests/browser/workspace-hub.spec.cjs -g "unified workspace"` | 通过 |
| `npx playwright test tests/browser/figma-layout.spec.cjs` | 通过 |
| `npx playwright test tests/browser/documents.spec.cjs` | 通过（三人协作、离线重连、评论、版本、私有副本恢复） |
| `npx playwright test tests/browser/assistant.spec.cjs` | 通过 |
| `npx playwright test tests/browser/mermaid-ux.spec.cjs` | 通过 |
| `npx playwright test tests/browser/business-diagrams.spec.cjs` | 通过 |
| `npx playwright test tests/browser/mermaid.spec.cjs` | 通过 |
| `INVITATION_BROWSER_TEST=1 INVITATION_MAIL_LOG=.test-runs/api-redesign-3.log npx playwright test tests/browser/invitations.spec.cjs` | 通过（双账号邀请、接受/拒绝、锁定注册、租户隔离） |

新增浏览器验收覆盖：

1. 桌面与移动端不存在常驻左侧栏；抽屉可通过菜单按钮打开、Escape 关闭；焦点回到触发按钮。
2. 抽屉仅保留核心入口；工作区不再单独占导航；设置入口位于身份信息下方；`/settings` 可按权限显示成员、邀请、角色、审计、系统与监控。
3. 项目空间可创建/编辑/删除工作区，创建/删除项目；旧 `/workspaces` 地址回到工作区面板。
4. AI 助理可读取真实项目；确认后在真实接口创建工作区、项目、任务、文档，把任务更新为 `DONE`，随后通过 API 回读验证；文档创建成功后跳转编辑器。
5. 普通成员请求创建工作时被拒绝，且不出现“确认执行”。

截图（本次运行生成）：

- [桌面概览](ui-redesign-2026-11-20/redesign-dashboard.png)
- [抽屉导航](ui-redesign-2026-11-20/redesign-drawer.png)
- [项目空间](ui-redesign-2026-11-20/redesign-projects.png)
- [设置中心](ui-redesign-2026-11-20/redesign-settings.png)
- [AI 工作助理](ui-redesign-2026-11-20/redesign-agent.png)
- [移动端概览](ui-redesign-2026-11-20/redesign-mobile.png)
- [移动端抽屉](ui-redesign-2026-11-20/redesign-mobile-drawer.png)

## 2026-11-20 上线与线上验收

发布范围仅本轮相关改动，基于 `e274a70` 的干净 worktree（分支 `release/ui-agent-20261120`）。

### 前端

- Vercel 项目 `purelamp/collabspace` 生产部署完成，40 个页面构建通过。
- 部署地址 `https://collabspace-9jmy1d0n3-purelamp.vercel.app`，已别名到 `https://collabspace.purelamp.uk`。
- 使用干净 worktree 部署，未带入主工作区其他未提交改动。

### 后端

- API 镜像 `collabspace-api:api-r20261120-02`（`sha256:b2ae4807ca9d049caa28e4010e7978ea828564f1322369a666e4af241290ee99`），基于已验证的 r20261114-02 镜像只叠加 `apps/api/dist` 与 `packages/collab-store`。
- WS 保持 `sha256:0264eb32…938f` 不变；无数据库迁移。
- `/api/v1/health/ready` 返回 `database: up / redis: up`；新路由未登录返回 401（存在且受保护）；`Mail sink`、非特权数据库角色、会议表 FORCE RLS、JWT fail-fast、`mermaidAgentScope` 运行时校验均通过；OOM=false、restarts=0。
- 首次激活尝试因 `AssistantModule` 未导出 `AssistantService` 导致 readiness 失败并自动回滚；补充 `exports` 后二次发布通过，回滚镜像保留。

### 线上测试

| 检查 | 结果 |
| --- | --- |
| `ui-redesign.spec.cjs`（线上） | 3/3 通过：无左侧栏、抽屉导航、项目空间 CRUD、AI 确认写工作区/项目/任务/文档、成员越权拒绝 |
| `mermaid-ux.spec.cjs`（线上） | 通过：紧凑工具、流程/思维导图改字、拖拽、AI 与语音入口 |
| `ui-refresh.spec.cjs`（线上） | 通过：桌面与移动端导航 |
| `GET /agent/capabilities`（线上，已登录） | 200，`modelPlanning: true`，21 个工具 |
| `POST /documents/:id/agent/mermaid`（线上，真实 DeepSeek） | 201，约 1.35 秒，返回 `flowchart TD` 源码，`seq` 校验生效 |
| `GET /office/status`（线上） | `configured: true`、`storageReady: true`、`provider: onlyoffice`（生产已配置 Office，与本地区分） |

线上首次运行时演示组织已有 3 个非归档项目，触发套餐项目数上限，导致两个写用例失败；清理遗留的测试草稿项目与空工作区后复跑通过。该上限是套餐规则，不是本轮回归。

## 2026-11-20 补充：Office 工作台推倒重来

`/office/:id` 的 Word、Excel、PowerPoint 三种文件共用一套重新设计的工作台外壳；OnlyOffice 编辑器内核保留，不改写其文档渲染与保存逻辑。

### 设计

- 顶栏只保留返回、文件类型标识、标题、所有者/可编辑/只读徽章、连接状态、版本号与在线头像。
- 左侧改为竖向工具轨：保存、下载、版本、权限、文件、AI 工作助理、导航；移动端折叠为横向工具条。
- 编辑器占满剩余区域并置于圆角卡片内，状态信息收进底部细状态栏。
- 版本历史、访问权限、重命名/副本/PDF、图片预处理与帮助全部移入右侧检查器，按“版本 / 权限 / 文件”切换；桌面与编辑器并排，移动端全屏覆盖。
- 按文件类型着色：Word 蓝、Excel 绿、PowerPoint 橙；保存按钮保持唯一主操作。
- Office 页不再显示全局悬浮导航/AI 按钮，改由工具轨触发，避免遮挡底部状态栏。
- OnlyOffice 配置增加 `uiTheme: theme-light`、`compactHeader`、`hideRightMenu`，减少内嵌编辑器自带头部与菜单的视觉噪声。

### 发布

- 前端：Vercel 生产部署，部署地址 `https://collabspace-ilvlv0wrd-purelamp.vercel.app`，已别名到 `https://collabspace.purelamp.uk`。
- 后端：`collabspace-api:api-r20261120-03`（`sha256:330500e4af20c5cae1a9af7b2f07ec0af672ff95a74086064e2c2bfda1612250`），仅叠加 `packages/collab-store`；WS 保持 `sha256:0264eb32…938f` 不变。
- 健康检查 `database: up / redis: up`，OOM=false、restarts=0；回滚镜像 r02（`sha256:b2ae4807…ee99`）保留。

### 验证

| 检查 | 结果 |
| --- | --- |
| `office-page-polling.spec.cjs` | 通过：轮询期间始终只有一个操作面板与一个图片预处理面板 |
| `office-file-actions.spec.cjs` | 3/3 通过：docx/xlsx/pptx 重命名、按版本导出 PDF、副本重试幂等、只读用户不可写 |
| 线上 Word 打开 | `[data-office-ready=true]`，工具栏、页面、版本/权限/文件检查器均可用 |
| 线上 Excel 打开 | 编辑器就绪，类型标识为 Excel 绿色 |
| 线上 PowerPoint 打开 | 编辑器就绪，类型标识为 PowerPoint 橙色 |
| 线上移动端 390×844 | 编辑器可见且 `document.scrollWidth = 390`，无横向溢出；工具条不遮挡状态栏 |

截图：

- [Word 工作台](office-studio-2026-11-20/docx-studio-final.png)
- [版本历史](office-studio-2026-11-20/docx-versions.png)
- [文件工具](office-studio-2026-11-20/docx-files.png)
- [访问权限](office-studio-2026-11-20/docx-access-final.png)
- [Excel 工作台](office-studio-2026-11-20/xlsx-studio.png)
- [PowerPoint 工作台](office-studio-2026-11-20/pptx-studio.png)
- [移动端](office-studio-2026-11-20/mobile-studio-final.png)

## 未验证边界

- 模型调用已用真实 DeepSeek 密钥完成多轮小样本调用；未做并发、限流和长文本稳定性压测。
- 线上 `mermaid.spec.cjs` 被用例自身的本地门禁跳过；其源码权威、离线与历史恢复场景本轮以本地结果为准。
- 线上 Office 已实际打开 Word、Excel、PowerPoint 并确认编辑器就绪；本轮未在三种格式中写入正文、插入图片或触发多人并发保存。
- Office 内嵌 AI 段落改写依赖尚未进入本次发布基线的后端 Office Agent 接口，本轮未纳入工作台；现有版本、权限、文件操作与恢复能力完整保留。
- Figma MCP 未连接，未提供本次设计稿 URL；未做像素级设计还原与 Figma 节点核对。
- 模型规划已用真实 DeepSeek 密钥完成两次小样本调用；未做并发、限流和长文本稳定性压测。
- AI 助理当前不执行 Office 文件新建、文件上传、角色分配和系统参数修改；这些仍通过对应页面完成。
- 8 个 API 集成测试需要额外 PostgreSQL/Redis/Office/OAuth 环境，本轮按测试自身条件跳过。
- Redis 未启动，实时在线状态与跨节点广播未在本轮重新验收；既有文档、邀请和协作测试在单机降级模式下通过。

## 2026-11-20 补充：图表工作室、AI 画图与数字人形象

### 图表工作室合并

- 自由画布与 Mermaid 保留两种引擎，但合并到同一入口和同一工作台样式：顶部模式切换、左侧工具轨、紧凑工具栏、右侧属性检查器。
- 工具轨只保留选择/平移/连线与 7 种基础图元；文档、数据库、云服务等更多图元收进“更多图元”浮层，避免工具轨滚动。
- 连线：选中图元后四边出现蓝色连接点，可拖到目标图元直接建立连接；保留连接工具依次点选。
- 修复图形工具激活时点击已有图元会误选中并改字的问题；现在绘图工具在已有图元上也会创建新图元。
- Mermaid 工作区去掉重复标题和底部状态，视图切换改为分段控件；模板、源码、导入导出入口保持不变。

### AI 画图

- 新增 `POST /documents/agent/draw`：按自然语言调用 DeepSeek 生成 Mermaid，并原子创建带初始源码的 BOARD 文档。
- AI 助理识别“画/生成流程图、思维导图、架构图”等指令，返回 `draw_diagram` 计划；确认后创建并跳转，直接显示图表。
- 线上实测生成 `flowchart TD A[提交] --> B[审批] --> C[发布]`，创建和打开均成功。

### 线上发布

- API：`collabspace-api:api-r20261120-04`（`sha256:5634fc884e5b1e249dd21c785be31ea4cbcbce3ccde678086d3c57653d950e27`），基于 r03 只叠加 `apps/api/dist`；健康检查正常，OOM=false，WS 未变。
- 前端：Vercel 生产部署 `collabspace-neryt9glh-purelamp.vercel.app`，已别名到 `https://collabspace.purelamp.uk`。
- 数字人形象复用已上线的 Agent 身份卡：打开 `/assistant` 后“查看Agent形象”可用，展示小岚静态形象与“静态角色外观稿 · 可动3D模型尚未交付”。未再引入重复入口。

### 验证

| 检查 | 结果 |
| --- | --- |
| `board.spec.cjs` | 通过：双账号创建、拖动、撤销、离线重连、历史/恢复、只读 |
| `diagrams.spec.cjs` | 通过：绑定连线、导图、Mermaid 导入、SVG 导出 |
| `mermaid-ux.spec.cjs` | 通过 |
| 线上拖拽连线 | 4 个连接点，拖到目标后生成 1 条绑定连线 |
| 线上 AI 画图 | 创建成功并跳转，源码为 `flowchart TD` |
| 线上数字人形象 | “查看Agent形象”按钮启用，静态形象可见 |
| 线上 IM 双人 / 三人 | `im.spec` 1/1；`im-group.spec` 1/1，三账号实时互发并保留历史 |

截图：

- [画布工作室](board-ai-2026-11-20/board-studio-online-final.png)
- [AI 画图](board-ai-2026-11-20/agent-draw-online.png)
- [数字人形象](board-ai-2026-11-20/digital-human-online-avatar.png)
- [IM 数字分身](board-ai-2026-11-20/digital-human-online-im.png)
- [三人群聊](board-ai-2026-11-20/im-group-owner.png)

### 边界

- 两种视图仍使用独立数据模型（`shapes` 与 `mermaid` 文本）；本次完成入口与工作台合并，未做图形双向转换。
- Mermaid 编辑器内核与图元属性面板保留，仅统一外观；复杂图表的自动布局仍以 Mermaid 预览为准。
- 数字人目前是静态形象与私有素材草稿；真实生成供应商未接入，界面不会伪造创建成功。

## 2026-11-21 补充：Mermaid 一键转自由画布

- 图表工作区新增“转到自由画布”：解析当前 Mermaid 源码，追加为可拖拽图元与绑定连线，并自动切换到自由画布。
- 保护边界：只追加、不覆盖已有画布；源码为空、解析失败、超过 500 图元或图元已存在时给出明确提示；只读成员不可转换。
- 这样 AI 画图生成的 Mermaid 可以直接进入自由画布继续拖拽、改字和连线，减少两种视图之间的重复操作。
- 前端生产部署：`collabspace-i0p5caoh5-purelamp.vercel.app`，已通过服务器侧验证正式域名返回 200；本机到 Vercel 的网络在部署后短暂超时，浏览器侧转换验收待网络恢复后补跑。
