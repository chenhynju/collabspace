# CollabSpace — 多人实时协作文档

2026-10-26追加：画布蓝色连接点可直接拖到另一图元连线，支持箭头样式/文字、取消、位置保留及多人同步；[契约](docs/collaboration/MERMAID-POSITION.md)、[实际验收](evidence/collaboration/MERMAID-CONNECT-2026-10-26.md)。

2026-10-26：Mermaid实际画布拖入/移动、位置保存与局部删除已上线，正式4/4验收通过；[中文演示白板](https://collabspace.purelamp.uk/projects/cmvg1shjj001w55oco1ou87o3/documents/f4752774-d481-49a8-a5f9-f84c6870de05)、[范围](docs/collaboration/MERMAID-POSITION.md)、[验收发布](evidence/collaboration/MERMAID-POSITION-2026-10-25.md)。复杂结构自由定位仍明确限制，原图不被擅自覆盖。

2026-10-25：IM/助手功能入口按钮化，隐藏未提供功能的占位项；[范围与规范](docs/collaboration/ACTION-UI.md)、[测试与发布](evidence/collaboration/ACTION-UI-2026-10-25.md)。

2026-10-25后续：Azure海内外统一选型、IM话筒听写改版与受限助手工作流，见[听写体验](docs/collaboration/VOICE-DICTATION-UX.md)、[验收与发布](evidence/collaboration/DICTATION-RUNTIME-2026-10-25.md)。Azure/真人服务尚未开通，真实语音与视频不计为通过。

2026-10-25：本轮语音与数字形象的[功能清单和待完成项](docs/collaboration/VOICE-PERSONA-STATUS.md)、[详细自测表](evidence/collaboration/VOICE-SELFTEST-2026-10-25.md)已整理；区分正式/本地成绩、替身、供应商阻塞和未验收项。

2026-10-25：语音消息、3D卡通预览与邮件语音工具已更新到现有正式站点；云识别/合成和真人服务仍未配置。版本、CPU/内存/磁盘、备份与双账号正式验收见[语音与形象上线报告](evidence/collaboration/VOICE-RELEASE-2026-10-25.md)。

2026-10-25：语音与数字形象规划已确定，涵盖IM、邮件及未来Agent/Skill；采用独立模块融入现有体系。需求、技术栈、范围及AT-VP01–08见 [语音与数字形象](docs/collaboration/VOICE-PERSONA.md)。已完成部分本地实现，实际通过项、供应商阻塞与未完成范围见[本地验收报告](evidence/collaboration/VOICE-PERSONA-2026-10-25.md)，不代表完整验收或生产发布。

2026-10-25：协作助手（Word/PDF摘要、行动项、确认后邮件、中英翻译、朗读）、Office文件操作/PDF和本地图片准备已部署；入口 [协作助手](https://collabspace.purelamp.uk/assistant)。实际验收、运行版本、备份及回退见 [发布记录](evidence/collaboration/RELEASE-2026-10-25.md)。

2026-10-24：多项目 Resend 回调验签、业务分流、持久化队列与其他项目适配补丁，见 [邮件回调路由](docs/collaboration/MAIL-WEBHOOK-ROUTING.md)。

2026-10-24：新增富文本文档数学公式模板拖拽、LaTeX 输入与源码修改，P-MATH / BR-MATH / D-MATH / AT-MATH 及客户端升级要求见 [数学公式](docs/collaboration/MATH.md)。

本工程从 F-U01 / TeamSpace 当前文件快照独立复制，私有仓库为 chenhynju/collabspace。已实现项目协作文档、多人编辑、离线草稿、评论、命名版本和文档权限；已上线独立演示环境，实际验收与边界见下方证据。

在线文档支持富文本、正文配图、图片说明及宽度、上传/粘贴/拖入图片，并沿用多人同步和私有版本恢复。见 [图文写作契约](docs/collaboration/RICH_TEXT.md)、[验收与上线记录](evidence/collaboration/RICH-TEXT-2026-10-21.md)；登录后可打开 [图文协作示例](https://collabspace.purelamp.uk/projects/cmvg1shjj001w55oco1ou87o3/documents/30ae9064-e8e2-4ee6-8d24-9de1eb50f2e3)。

白板图表以 Mermaid 源码为主要执行标准，支持图形 / 源码 / 分屏视图，并保留自由画布。官方渲染、共享源码、版本及未来 AI 受控编辑契约见 [Mermaid 设计](docs/collaboration/MERMAID.md)；任意 Mermaid 语法的图形拖动回写尚未完成。

第二轮增加受支持流程图的拖入图元/节点连线、基础思维导图子树拖动、评论/版本实时提示和离线配图。范围与验收见 [第二轮设计](docs/collaboration/ITERATION-2.md)。GitHub/Google 社交登录的供应商配置见 [操作备忘录](docs/collaboration/OAUTH-SETUP-MEMO.md)。

- [需求分析](docs/collaboration/REQUIREMENTS.md)
- [详细设计](docs/collaboration/DESIGN.md)
- [开发 Prompt](docs/collaboration/IMPLEMENTATION_PROMPT.md)
- [复制与验证边界](docs/collaboration/BASELINE.md)
- [实现取舍与本地运行](docs/collaboration/IMPLEMENTATION_NOTES.md)
- [English walkthrough](docs/collaboration/README.en.md)
- [当前实时协作主线与线上验收](evidence/collaboration/REALTIME-2026-10-21.md)
- [首次文档验收状态](evidence/collaboration/ACCEPTANCE-2026-10-20.md)

2026-10-21：新增侧栏“项目协同 → 实时协作”入口，按项目进入协作文档或实时白板。白板的功能边界、同步/冲突与权限设计见 [WHITEBOARD.md](docs/collaboration/WHITEBOARD.md)。生产验收以对应报告为准，不把历史文档成绩视为白板成绩。

以下为继承的 TeamSpace 文档，部署域名、资源和证据仅供追溯，不代表新工程发布状态。

# F-U01 Multi-Tenant B2B SaaS

**建议产品：TeamSpace：企业项目协作云。** 文档更新：2026-10-07；产品和岗位资料核查：2026-10-06。

本题来源是原始表格中的一句话设计。本文件把它展开为可讨论和实现的产品方案；产品名、具体用户场景、功能、状态和指标均是推导，不代表已完成用户访谈或市场验证。基础需求见 [REQUIREMENTS.md](REQUIREMENTS.md)，工程详细设计见 [DESIGN.md](DESIGN.md)。

## 产品形态与最终用户

**形态：**企业协作 SaaS 控制台与租户管理 API。

**具体使用场景：**一家 50 人咨询公司同时服务多个客户；管理员隔离客户工作区，员工协作交付，财务管理席位。以项目与交付物作为租户能力的具体业务载体。

**用户当前问题：**企业管理员需要为多团队分配空间和权限；成员只应看见所属租户资料。产品的价值由这些任务完成后的业务结果衡量，而不是由使用多少框架衡量。

| 用户角色 | 主要目标 | 可操作边界 |
| --- | --- | --- |
| 管理员 | 开通企业并创建客户工作区 | 组织、工作区和项目分别授权，显示当前组织；切换组织清空本地资源缓存 |
| 管理员 | 邀请员工并限制外部协作者 | 邀请绑定邮箱、组织、角色和过期时间，接受前校验身份；撤回立即失效 |
| 项目负责人 | 分派任务并审阅交付物 | 项目关联任务和文件版本；客户访客仅见明确共享的交付物 |
| 企业 IT | 用公司身份登录并撤销成员 | SSO 和目录同步映射本地成员；离职撤销生效于后续请求 |
| 财务管理员 | 核对席位与套餐权益 | 席位口径明确为有效成员；超限给出原因；权益变更记录来源事件 |

## 相似产品如何帮助推导需求

以下官方产品或生态资料提供功能形态参照；引用仅支持所列功能信号，不说明竞品内部架构，也不把本题设计当作竞品完整规格。

- [WorkOS 企业身份功能](https://workos.com/docs)：组织、角色、SSO、目录同步与审计。

**推导方法：**从用户问题确定任务，再确定页面/API 和业务规则；从规则反推出状态、数据、权限与异常。每项产品需求 P 对应一项基础需求 BR、工程约束 D 和验收 AT，三份文档可按编号核对。产品形态取其中适合单人/小团队交付的范围，未验证的商业假设仍需用户访谈。

## 完整用户旅程

概览：创建组织→创建工作区→邀请成员→授予角色→访问资源→查看审计。

1. **管理员：开通企业并创建客户工作区。** 组织、工作区和项目分别授权，显示当前组织；切换组织清空本地资源缓存。成功反馈是“成员切换组织后无法读取上一组织项目”；无法完成时保留当前业务状态与可解释原因。
2. **管理员：邀请员工并限制外部协作者。** 邀请绑定邮箱、组织、角色和过期时间，接受前校验身份；撤回立即失效。成功反馈是“过期或被撤销的邀请不能加入”；无法完成时保留当前业务状态与可解释原因。
3. **项目负责人：分派任务并审阅交付物。** 项目关联任务和文件版本；客户访客仅见明确共享的交付物。成功反馈是“访客猜测内部文件 ID 得到拒绝”；无法完成时保留当前业务状态与可解释原因。
4. **企业 IT：用公司身份登录并撤销成员。** SSO 和目录同步映射本地成员；离职撤销生效于后续请求。成功反馈是“撤销后已有会话不能继续访问组织”；无法完成时保留当前业务状态与可解释原因。
5. **财务管理员：核对席位与套餐权益。** 席位口径明确为有效成员；超限给出原因；权益变更记录来源事件。成功反馈是“重复计费事件不会重复增加权益”；无法完成时保留当前业务状态与可解释原因。

## 功能需求与业务规则

以下表格描述完整产品的基础需求，并标明 P0/P1。范围说明把原题落实为具体示例；审批、对账、最终确认等当前路径的正确性环节不因为界面较少而被推迟。

| 需求 ID | 优先级 | 用户 | 要完成的任务 | 产品行为与规则 | 验收结果 |
| --- | --- | --- | --- | --- | --- |
| F-U01-P01 | P0 | 管理员 | 开通企业并创建客户工作区 | 组织、工作区和项目分别授权，显示当前组织；切换组织清空本地资源缓存 | 成员切换组织后无法读取上一组织项目 |
| F-U01-P02 | P0 | 管理员 | 邀请员工并限制外部协作者 | 邀请绑定邮箱、组织、角色和过期时间，接受前校验身份；撤回立即失效 | 过期或被撤销的邀请不能加入 |
| F-U01-P03 | P0 | 项目负责人 | 分派任务并审阅交付物 | 项目关联任务和文件版本；客户访客仅见明确共享的交付物 | 访客猜测内部文件 ID 得到拒绝 |
| F-U01-P04 | P1 | 企业 IT | 用公司身份登录并撤销成员 | SSO 和目录同步映射本地成员；离职撤销生效于后续请求 | 撤销后已有会话不能继续访问组织 |
| F-U01-P05 | P0 | 财务管理员 | 核对席位与套餐权益 | 席位口径明确为有效成员；超限给出原因；权益变更记录来源事件 | 重复计费事件不会重复增加权益 |

## 信息架构与交互状态

首版主要页面/模块：**组织设置、成员邀请、角色矩阵、工作区、审计时间线**。

- 入口展示当前身份、组织或链与可执行动作；资源列表支持搜索、筛选、空状态和无权限状态。
- 详情页用业务语言解释当前结果、下一步与失败原因；长任务显示持久进度，不用一直加载的 spinner 代替状态。
- 有费用、写入或资产影响的动作，显示具体对象、金额/参数和生效时间；确认记录绑定实际操作内容。
- 编辑时保留草稿；网络失败支持恢复；无权操作有明确反馈。权限由后端和必要的合约层决定。
- 支持键盘操作、表单标签、焦点管理、可辨识错误及移动响应。海外作品集建议提供英文主要流程与英文运行说明，语言文本集中管理。

## 首版与后续范围

**P0：**P0 实现两组织、两工作区、成员邀请、项目交付、权限和套餐沙盒；不实现完整项目管理套件。

**后续：**P1：SAML/SCIM、可配置角色与企业审计导出；P2：独立数据库租户和区域部署

外部依赖用明确契约和模拟器/沙盒完成开发，界面注明当前环境。模拟成功、真实 API 成功、付费完成或链上最终确认分别验收。

## 数据、状态与权限要求

业务状态：**Invitation: pending → accepted / revoked / expired；Membership: active → suspended → removed；Project: draft → active → delivered → archived**。

关键规则：

- 所有业务查询必须带服务端验证的 organization_id，数据库 RLS 为防御层。
- 不能删除最后一个有效 owner。
- 审计记录 actor、资源、前后差异和 trace_id，敏感字段脱敏。

核心对象和字段、接口、写入归属、恢复步骤见 [DESIGN.md](DESIGN.md)。数据与文件的删除、脱敏和保留规则在接真实用户前确定；规划阶段不承诺监管资质或现成合规认证。

## 技术栈与远程岗位匹配

首选后端：**NestJS + TypeScript**；主数据库：**PostgreSQL**。完整组件与使用理由如下：



| 层级 | 建议组件 | 选择理由/边界 |
| --- | --- | --- |
| 用户界面 | React + Next.js + TypeScript + Tailwind CSS；shadcn/ui、TanStack Query/Table、React Hook Form + Zod 按界面需要选用 | 共享用户指定前端主线；扩展/平台嵌入采用相应宿主约束 |
| 主后端 | NestJS + TypeScript | 业务模块、认证 Guard、DTO 校验、REST/OpenAPI、队列与领域服务由 NestJS 管理；Next.js 承担 Web 界面，核心领域规则集中在后端。 |
| 主数据库 | PostgreSQL | 关系、事务、状态与审计适合本题，默认 Prisma。复杂约束、锁和 RLS 使用显式数据库机制；ORM 不替代业务事务。JSONB 足以承载多数半结构化 payload。 |
| 服务端 ORM / 数据访问 | Prisma / Drizzle 按 TypeScript 服务端需求择一；Python/Go/Rust 使用对应生态 | TypeScript 服务端默认 Prisma，重 SQL/显式查询可选 Drizzle；Python 使用 SQLAlchemy + Alembic；Go 使用 pgx/sqlc，Rust 使用 sqlx。浏览器不直接持数据库连接。Next.js 只做 UI/BFF 所需数据访问，领域写入归主后端；为多语言明确迁移与实体写入归属。 |
| 专项生态 | Prisma、PostgreSQL RLS、WorkOS、Stripe Billing | 围绕本题状态、数据和运行需求选；标为 P1/备选的工具不作为首版依赖 |
| 邮件与通知 | Resend + React Email；SES 为规模化或 AWS 备选；Twilio 仅在短信/语音需要时加入 | 邮件 job、投递事件和业务成功分别记录；退信/失败可追踪 |
| 鉴权 | WorkOS AuthKit/SSO + 应用授权；本地 Keycloak/OIDC 替身 | 认证供应商只确认身份；资源权限仍由本项目服务端执行 |
| 支付/套餐 | Stripe Checkout/Billing + Customer Portal，沙盒验签与事件对账 | 不用软件订阅收款代替账本、托管或协议的资产状态 |
| 可观测与告警 | 结构化 JSON 日志（AsyncLocalStorage 注入 traceId）+ `/health` 存活/就绪探针 + CloudWatch 告警（CPU/5xx/不健康实例/RDS 存储） | 日志可被 CloudWatch/ELK/Loki 直接解析；探针驱动 ALB/Nginx 自动摘流 |
| 开发与部署 | **Docker 多阶段构建** + **GitHub Actions CI/CD**（lint/build/test + 镜像推送 ECR + ECS 滚动部署）+ **Terraform IaC**（VPC/ECS Fargate/ALB/RDS/ElastiCache/CloudWatch/Route53）+ **Nginx 反代** + **Hetzner VPS 自托管** 备选 | 每条部署路径都有可执行代码；密钥走 GitHub Secrets / AWS Secrets Manager，仓库仅含 `.example` |

主投 Full-Stack/Backend SaaS 或对应专项岗位；J01/J02 展示 React/Node/SQL 和 Next.js/TypeScript 组合。NestJS 是结合用户偏好与模块化需求的选择；本次样本不支持宣称 NestJS 占岗位多数。 样本编号和地区限制见 [岗位与产品来源](../../SOURCES.md)；全局选型规则见 [技术栈策略](../../TECH_STACK.md)。这是有限岗位样本下的选择建议，不是招聘市场份额统计，也不保证在中国可申请所有列出的岗位。

## 非功能目标与产品成功指标

- 首先验证所有 P0 业务规则；错误拒绝、重复处理、状态解释与恢复是质量门槛。
- 本地性能基线建议在 4 vCPU/16GB、10 个并发、合成数据下测量普通 API p95 ≤ 500ms；不把模型推理、GPU 训练、区块确认等外部时间计入普通 API 目标。测量必须记录数据规模与环境。
- 长任务入口先持久化任务再返回 ID；进度、取消和错误在刷新后仍可查。超时、并发与预算以配置控制，避免无限重试。
- 以本题功能表的独立验收结果作为首要质量指标；成功率统计排除被正确拒绝的请求，并单列异常和恢复结果。
- 产品指标至少包括任务完成率、首次获得价值的时间、人工修正/接管比例和每次成功结果的成本；按本题角色建立基线后再设商业目标。

## 部署与平台工程能力

本仓库自带生产级部署代码，覆盖三条路径，展示「全栈 + 平台工程」复合能力：

| 路径 | 代码位置 | 适用场景 |
| --- | --- | --- |
| **AWS ECS Fargate**（主路径） | `terraform/` + `.github/workflows/` | 弹性伸缩、托管数据库与缓存、CloudWatch 监控 |
| **Hetzner VPS 自托管** | `deploy/hetzner/` + `docker-compose.prod.yml` + `deploy/nginx.conf` | 预算敏感、数据自持、单节点即可跑全套 |
| **云托管** | `deploy/DEPLOY.md`（Vercel + Render/Railway + Neon + Upstash） | 零运维快速上线 |

**CI/CD（`.github/workflows/`）：**
- `ci.yml` — PR 触发：lint、build、test、Terraform fmt/validate、Dockerfile hadolint
- `cd.yml` — 合入 main：构建多阶段镜像 → 推送 ECR → 更新 ECS 任务定义 → 滚动部署（OIDC 免长期密钥）
- `terraform.yml` — PR 输出 plan 评论、main 分支 apply（S3 remote state + DynamoDB 锁）
- `deploy-hetzner.yml` — 手动/VPS 路径：SSH 拉代码 + docker compose 部署

**IaC（`terraform/`）：** VPC（公/私有子网 + NAT）、ECS Fargate 集群与服务、ALB（HTTPS + WebSocket Upgrade + 路径分发）、RDS PostgreSQL（私有子网、加密、PITR）、ElastiCache Redis（TLS + AUTH）、IAM 最小权限角色、CloudWatch 日志组 + 告警 + 仪表盘、Route53 + ACM 证书自动校验。

**可观测：** API 输出结构化 JSON 日志（每行一个 JSON，traceId 经 AsyncLocalStorage 注入），`/health/live` 与 `/health/ready` 探针驱动 ALB/Nginx 摘流，CloudWatch 告警覆盖 CPU、5xx、不健康实例、RDS 存储。

密钥一律走 GitHub Secrets / AWS Secrets Manager，仓库仅含 `.env.production.example` 与 `terraform.tfvars.example`。

## 可审查交付

提供一条完整产品演示、合成数据与至少一个拒绝/故障恢复演示。自动化验收覆盖表中的 AT 结果与专项规则，工程约束见 DESIGN。交付报告写明代码、测试、供应商接入、付费/资金与生产环境分别验证到哪里。

AI 助手从 [AGENTS.md](AGENTS.md) 或 [CLAUDE.md](CLAUDE.md) 进入，专项步骤见 [SKILL.md](SKILL.md)。本目录当前是规划资料，不代表该产品已实现。

## 2026-10-19 共用 SaaS 底座扩展

用户新增需求覆盖原 P0 沙盒限制：Stripe 订阅、扁平协作单元与显式资源授权、文件持久化和恢复验收。P11/BR11/D11/AT11 至 P14/BR14/D14/AT14 的规则和追溯见 [共用底座设计](docs/FOUNDATION.md)。实际实现与验证以本次交付证据为准，不将设计当作验收结果。

