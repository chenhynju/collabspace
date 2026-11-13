# CollabSpace 用户使用与运维手册

> 版本：2026-11-13 ｜ 生产站点：https://collabspace.purelamp.uk
> 本手册面向两类读者：**使用者**（第 1–5 章）和**运维者**（第 6–10 章）。

---

## 1. 这是什么

CollabSpace 是一个**多人实时协作办公平台**：团队成员在同一份文档、白板、表格上同时编辑，内容实时同步、可离线续写、有不可变历史快照，并配有 AI 助手（摘要/翻译/写邮件）和数字人/语音等扩展能力。

技术栈：Next.js + NestJS + PostgreSQL（行级安全 RLS 多租户隔离）+ 独立 WebSocket 协作服务（Yjs CRDT）。

**核心概念三层结构**：

```
组织（Organization）→ 工作区（Workspace）→ 项目（Project）→ 协作内容（文档/白板/Office 文件）
```

- 一个账号可以属于多个组织；页面左上角的组织切换器切换身份。
- 所有内容挂在项目下；谁能看、谁能改，由组织成员身份 + 项目访问 + 文档级授权三层决定。

## 2. 角色与权限

| 角色 | 能做什么 |
|---|---|
| 所有者（OWNER） | 全部权限：编辑、授权、归档、删除、版本恢复 |
| 编辑者（EDITOR） | 编辑正文、评论、创建版本；不能改授权 |
| 评论者（COMMENTER） | 只能看和评论 |
| 只读者（VIEWER） | 只能看（编辑器锁定为只读） |

规则要点：
- 每个文档除项目权限外还有**独立的授权列表**（共享权限面板），可逐人授予/撤销。
- **最后一个有效 Owner 不可被移除**（系统强制）。
- 撤销权限后，对方的在线编辑会话会被**冻结**，本地未保存草稿无法上传，只能导出留存。
- 组织管理员也不天然能读文档内容，需要显式文档授权（RLS 兜底）。

## 3. 功能地图与使用

左侧导航（自上而下）：

### 3.1 通知中心
系统通知与邀请消息。收到组织邀请时可在此**接受或拒绝**。

### 3.2 概览
组织级仪表盘：项目、成员、近期动态汇总。

### 3.3 项目协同 → 工作区 / 项目
- 工作区是项目的分组；项目是所有协作内容的容器。
- 项目详情页可管理成员、进入「协作空间」（该项目视角的内容列表）。

### 3.4 协作空间（核心）
入口：`/collaboration`（全部内容）或项目详情页 → 协作空间（单项目视角）。

**创建内容**：首页五个类型卡片 —— 文档（富文本/Markdown）、白板 / Mermaid、Word、Excel、PowerPoint。
- 在「全部内容」视角点击卡片 → 弹出「选择存放项目」→ 点项目名直接创建并打开编辑器（自动命名「未命名XX」）。
- 在项目视角下点卡片 → 直接创建，无弹窗。
- 「新建」按钮走完整表单（可自选项目、自定义名称）；「上传文件」支持导入 .md/.mmd/.docx/.xlsx/.pptx 等（≤20MB，源码类 ≤200KB）。

**编辑器通用能力**（文档/白板共用）：
- **多人实时编辑**：正文通过 WebSocket 差量同步；同段冲突由 CRDT 自动合并；右侧可见在线成员。
- **离线续写**：断网可继续编辑，草稿存浏览器本地（IndexedDB），恢复网络后自动补传；状态栏区分「已保存到服务器」与本地待传。
- **评论**：选中正文 → 写评论；支持回复、标记解决；原文被删后评论仍可从列表找到。
- **历史版本**：
  - **自动快照**：有编辑时每分钟至多保留一份（不可变），侧栏「快照时间轴」可浏览。
  - **命名版本**：点「历史版本 → 创建版本」手动打检查点（如「客户确认 v1」）。
  - 任意版本可「只读预览」，可「恢复为副本」——恢复生成一份**仅自己可见的新文档**，绝不覆盖当前协作文档。
- **权限**：「共享权限」面板逐人授权/降级/撤销。

**文档（富文本）**：格式工具栏、正文配图（上传/粘贴/拖入，每文档累计 20 张/20MB）、图片说明与宽度、LaTeX 数学公式（模板拖拽 + 源码编辑）。

**白板 / Mermaid**：以 Mermaid 源码为权威，三种视图（图形/源码/分屏）。
- 图元库拖入或点击放置节点；连接工具或拖动蓝色连接点连线；支持箭头样式、连线文字。
- 思维导图：选中主题后 Tab 加子主题、Enter 加同级、自动布局。
- 内置业务图表模板库（24 套：流程/架构/审批等），模板替换有「他人已修改」防冲突提示。
- 支持导入 .mmd 文件、导出 SVG/PNG。
- 另保留独立「自由画布」（矩形/椭圆/便签/箭头/思维主题等，撤销仅作用于自己的操作）。

**Word / Excel / PowerPoint**：原生格式在线编辑器。
- 「服务器版本 vN · OPEN」显示保存状态；「保存到服务器」打检查点。
- 文件操作面板：**重命名、另存私有副本、导出 PDF**。
- 图片上传慢可先用「先缩小图片」面板本地压缩（可选 1280px 等小图预设）。
- 权限变更会导致会话**冻结**（FROZEN），防止旧会话覆盖他人成果；冻结后可从「恢复候选」找回未保存内容。

### 3.5 附件管理
项目文件库：上传（需 file:manage 权限）、下载、按项目归档。Office 文件可从这里「打开」进入在线编辑器。

### 3.6 消息
组织内即时消息（IM）。支持语音消息（浏览器录音转草稿后发送）。无 Redis 时自动降级为单实例模式，功能不受影响（仅横向扩展受限）。

### 3.7 组织管理
成员列表、角色管理、邀请新成员（邮件邀请，7 天有效；受邀邮箱锁定，接受后才计入成员）。

### 3.8 系统管理 / 系统监控（仅 OWNER）
- 系统管理：组织级配置、套餐沙盒。
- 系统监控：服务器/数据库健康指标、审计记录（所有敏感操作留痕：操作人、资源、前后差异、trace_id，敏感字段脱敏）。

### 3.9 AI 助手（协作空间 → AI 助手 标签页）
对项目资料做：**生成摘要、提取行动项、中译英、英译中、写邮件**（确认后才发送，邮件全程可预览）。助手产出可一键落成新文档。

### 3.10 语音与数字人（Persona）
- 语音人设：配置 Agent 的语音风格/语言，3D 卡通形象预览与偏好持久化。
- 语音邮件工具：把文本转为语音预览（当前为预览，不自动外发）。
- 边界：20 款原创可动模型、真人数字分身生成尚未交付（见第 5 章）。

### 3.11 会议（当前生产禁用）
会议模块代码已在库（预约、聊天、RTC 音视频），生产开关 `MEETINGS_ENABLED=false` 保持关闭，入口不展示。不要用旧证据认为会议已上线。

## 4. 账号与安全

- 注册需**邮箱验证**（收验证邮件 → 点链接完成）。没收到邮件检查垃圾箱；链接有效期有限，过期重发。
- 登录失败**限流**：同一 IP+邮箱 5 分钟内错 5 次，第 6 次起返回 429 并提示倒计时，窗口过后自动恢复。这是防盗刷特性，不是故障。
- 「账号安全 · 修改密码」：改密后旧登录态失效；忘记密码走登录页「重置密码」邮件链路。
- 退出登录会清除本机的离线草稿缓存（换账号前如有未同步草稿，请先联网同步）。

## 5. 已知边界（重要，避免误解）

| 能力 | 状态 |
|---|---|
| 文档/白板/Markdown/Office 协作、版本、权限 | ✅ 生产已验收 |
| 邮件（注册验证/邀请/项目邮件） | ✅ Resend 真实外发；@example.invalid 合成域名永远只落日志（测试汇） |
| 支付（Stripe/PayPal） | ⚠️ 仅 sandbox，收款入口已禁用 |
| 会议/音视频 | ⛔ 生产关闭（`MEETINGS_ENABLED=false`） |
| 真实语音 ASR/TTS（Azure/豆包） | ⚠️ 代码就绪，供应商未开通 |
| 20 款原创可动数字人、真人分身 | ⛔ 未交付 |
| 多实例正文同步、跨地域 | ⚠️ 未验证（当前单实例） |
| 容量 | 单文档完整状态上限 5MiB；WS 单帧 256KiB；列表页最近 100 条 |

---

## 6. 生产架构（运维）

```
浏览器 ──> Vercel（前端 collabspace.purelamp.uk，project: collabspace）
       ──> 腾讯云轻量服务器 170.106.161.82（Docker Compose 链）
             ├── collabspace-api（NestJS，collabspace-api.purelamp.uk/api/v1）
             ├── collabspace-ws（独立原生 WebSocket 协作服务 /collab）
             ├── PostgreSQL 16（原生，FORCE RLS；compose 内网，不暴露宿主端口）
             └── Redis（IM 广播/缓存，可选降级）
```

- 配置基线：`docker-compose.prod.yml` + 服务器 `/opt` 下的 override；**WS 的 `native-ws.json` 必须保留在 Compose 链**，不能只重跑历史 Compose。
- 功能开关：`MEETINGS_ENABLED=false`、`MEETINGS_ACCESS_MONITOR_ENABLED=false`。
- 域名/证书：DNS + 反代 + TLS 已在服务器侧配置；API 与 WS 同域不同路径。

## 7. 发版流程（已参数化，照最近一次的发布记录走）

**前端（Vercel）**：
```powershell
cd apps/web 对应仓库根
vercel --prod   # 从 main 部署；部署后确认 Ready 且成为最新 Production
```

**后端（打包 → 服务器构建 → 备份 → 激活 → 验证）**，参照 `evidence/collaboration/RELEASE-AUTH-HARDENING-2026-11-12.md`：
1. 本地 `prepare-*.cjs`：FROM 当前生产镜像打 delta tgz（含 sha256 + 文件 manifest）。
   - 注意：Windows git-bash 的 tar 不认 `D:` 路径，tar 步骤用 POSIX 路径手动执行。
   - **必须重新构建 dist**：本机全量 `nest build` 慢（>300s），可按 tsconfig 同标志定向 `tsc` 编译改动文件，但要跑探针验证（r20261112 曾拦下陈旧 dist 事故）。
2. 上传服务器 → `review-build-*.sh`：sha256 校验 → 解包 → manifest 逐文件校验 → 双镜像构建 → 镜像内跑 `node --test` 套件。
3. `review-activate-*.sh`：**备份先行**（pg_dump + uploads 卷 tar + sha256）→ override 切新镜像 → compose up → 健康等待。
4. `review-verify-*.sh`：镜像一致性、health/ready 双端 200、RLS 在位、OOM/restarts 检查。
5. 写发布记录到 `evidence/collaboration/` 并推送 main。

**回滚**：previous 镜像保留在服务器；activate 脚本内置 rollback（切回旧镜像 compose up）。数据库只做 additive 迁移（新列/新表），应用回滚不 DROP 任何表。`CREATE POLICY` 类迁移不可重跑，回滚校验用「存在性检查」而非重放。

## 8. 日常运维

**健康检查**：
```bash
curl https://collabspace-api.purelamp.uk/api/v1/health/ready   # 期望 status: ok
```
登录生产站点 → 系统监控页看服务器/数据库实时指标。

**备份**：每次发版由 activate 脚本自动 pg_dump + uploads 打包（校验 sha256，权限 600）。数据库/上传备份与旧镜像保留在服务器。**正式的备份还原演练尚未做过**——这是发布门禁级别的待办。

**磁盘**：服务器 `/opt` 余量偏紧（2026-11-12 时 8.1G / 86%）。下次发版前先 `docker system df`，必要时 `docker image prune` 清理未用镜像（别删 previous 回滚镜像）。

**日志**：`docker logs --since 10m collabspace-api-1`（容器名以 compose 实际为准）。合成测试邮箱（@example.invalid）的邮件内容以 `[verify] / [invite] / [reset]` 前缀落在这里，供验收工装读取。

**登录限流**：单实例内存计数（IP+邮箱，5 次/5 分钟）。水平扩容时需换 Redis 计数（代码已标注）。

## 9. 本地开发

```powershell
pnpm install --frozen-lockfile
pnpm local:up     # 起隔离 PG(5548)+API(43121)+Web(43120)+WS(43122)，首次自动 seed
```
- 合成账号：`owner@acme.dev` / `admin@acme.dev` / `member@acme.dev`，密码见 `.test-runs/collab-local/config.json`（本地合成，勿用于生产）。
- Redis（可选）：`wsl -d Ubuntu-24.04 --exec sh -c 'exec /usr/bin/redis-server --bind 127.0.0.1 --port 6399 --save "" --appendonly no'`。无 Redis 时 IM 降级单实例，正文同步不依赖 Redis。
- 测试：
  ```powershell
  pnpm --filter @teamspace/api test     # API 单测（测试自管 PG）
  pnpm --filter @teamspace/web test     # Web 单测
  node scripts/test-collab.cjs          # collab-store 真实 PG/WS（需 local:up 的 config.json）
  node node_modules/@playwright/test/cli.js test    # 浏览器验收
  ```
- 浏览器在线回归：`COLLAB_BROWSER_CONFIG=.test-runs/deploy/ui-online-config.json` + 各功能门控 env；fixture 类 spec（hub-direct/meetings/persona-motion）需显式设置 `*_FIXTURE_URL` 指向本地夹具服务，否则自动跳过。

**常见坑**：
- 杀掉跑测试的终端后，embedded PG 的 postmaster 可能残留，占住 5548 端口和共享内存（报 `pre-existing shared memory block is still in use` / `could not bind`）：`tasklist | findstr postgres` 找到 Console 会话的残留进程 `taskkill /PID <pid> /F` 即可。
- 改 API 代码后必须重编 dist 再打镜像（见 7.1 的陈旧 dist 事故）。

## 10. 演示路线（给客户/面试官看的 6 步）

1. Owner 创建项目文档，共享给另一账号 Editor、客户 Commenter。
2. 两个浏览器同段编辑：看在线名单、实时合并。
3. Editor 断网续写、Owner 在线改；恢复网络看两种保存状态。
4. 选中段落评论，另一账号解决；删原文后评论仍可定位。
5. 创建「客户确认」版本 → 只读预览 → 恢复为副本；确认原文未被覆盖、客户默认看不到副本。
6. 撤销 Editor 权限后重连：草稿无法上传、新内容不可见。

---

**文档索引**：需求 `docs/collaboration/REQUIREMENTS.md` ｜ 设计 `DESIGN.md` ｜ 发布证据 `evidence/collaboration/` ｜ 第三方服务清单 `docs/collaboration/THIRD-PARTY-SERVICES.md` ｜ 全量回归基线 `evidence/collaboration/FULL-REGRESSION-2026-11-13.md`
