# 可直接交给开发 Agent 的 Prompt

2026-10-25入口整理：操作区域按钮化、未提供功能的占位项移除，P/BR/D/AT-AUI见[功能入口规范](ACTION-UI.md)，范围和实际成绩见[验收记录](../../evidence/collaboration/ACTION-UI-2026-10-25.md)。

2026-10-25后续入口：按[听写体验](VOICE-DICTATION-UX.md)、[供应商决策](SPEECH-PROVIDER-SELECTION.md)、[最新验收发布](../../evidence/collaboration/DICTATION-RUNTIME-2026-10-25.md)继续。当前Azure海内外统一选型、OpenAI仅未来海外适配；没有Azure/真人凭据，不编造真实语音/视频验收。受限助手真实DeepSeek已验证，后续需补持久运行、真实语音、真人视频、货币预算和定时物理清理。

2026-10-25：语音与数字形象规划已确定，涵盖IM、邮件及未来Agent/Skill；采用独立模块融入现有体系。需求、技术栈、范围及AT-VP01–08见 [语音与数字形象](VOICE-PERSONA.md)。已完成部分本地实现，实际通过项、供应商阻塞与未完成范围见[本地验收报告](../../evidence/collaboration/VOICE-PERSONA-2026-10-25.md)，不代表完整验收或生产发布。

2026-10-24 最新授权增加协作助手。按 [ASSISTANT.md](ASSISTANT.md) 实现与验收摘要、行动项、中英互译、朗读和预览确认后的项目邮件。DeepSeek按需且有限额；开发不发真实测试邮件，不自动部署生产。保留共享工作树，实际进展见 ../../evidence/collaboration/ASSISTANT-2026-10-24.md。

2026-10-24：统一协作空间、空白 Office 创建和入口/权限验收，见 [UNIFIED-WORKSPACE.md](UNIFIED-WORKSPACE.md)。

2026-10-24：新增富文本文档数学公式模板拖拽、LaTeX 输入与源码修改，P-MATH / BR-MATH / D-MATH / AT-MATH 及客户端升级要求见 [数学公式](MATH.md)。

2026-10-22 高频业务绘图扩展：场景覆盖、24个模板/图元、源码属性操作、导入及SVG/PNG交付见 [BUSINESS-DIAGRAMS.md](BUSINESS-DIAGRAMS.md)。90%是待业务验收的目标，不是已通过比例。

2026-10-22 编辑体验改进：完整 Office 工具入口、协作/设计工作区 UI、文件最近编辑人与确认保存日期，契约见 [EDITOR-EXPERIENCE.md](EDITOR-EXPERIENCE.md)。

用户新增必需范围：原生.md源码多人协作、.docx/.xlsx/.pptx在线共同编辑、真实编辑者显示与冲突/保存管理，以Microsoft Office文件往返验收。原生 Markdown 与 Office 协作已上线；验收及剩余边界见 ../../evidence/collaboration/OFFICE-ONLINE-2026-10-22.md。详见 [COLLABORATIVE-FILES.md](COLLABORATIVE-FILES.md)。

2026-10-21 第二轮追加：受支持 Mermaid 流程图/基础思维导图拖拽直接修改共享源码；评论/版本提交后实时通知；账号/租户/文档隔离的离线配图；Google/GitHub 社交登录安全完善。最新契约和验收以 [ITERATION-2.md](ITERATION-2.md) 为准，配置见 [OAUTH-SETUP-MEMO.md](OAUTH-SETUP-MEMO.md)。历史未实现描述不覆盖本轮新增能力；任意语法/坐标回写、完整离线应用壳及企业SSO仍不宣称完成。

2026-10-21 图文写作追加：在线文档提供知乎式富文本写作体验，格式工具、图片上传/粘贴/拖入、图片说明及宽度、图片级文档授权和带配图版本恢复；沿用 Tiptap/Yjs。新增模型、兼容发布和 RT01–RT05 验收见 [RICH_TEXT.md](RICH_TEXT.md)。

2026-10-21 最新决定：Mermaid 是白板图表的主要执行标准，源码为权威，支持图形 / 源码 / 分屏视图，面向后续受控 AI Agent 修改。此决定覆盖旧的基础语法交换范围；模型、迁移兼容、安全及 MM01–MM05 见 [MERMAID.md](MERMAID.md)。

2026-10-21 用户追加图解工作区：参考 draw.io / Visio 和 Mermaid，支持流程图、绑定连接线、思维导图及基础源码交换。具体模型、交互和 DG01–DG04 见 [DIAGRAMS.md](DIAGRAMS.md)，不宣称完整格式或语法兼容；仍复用原协作、权限和离线体系。

2026-10-21 07:56 续做范围：实时协作为主线，多租户/资源权限是安全支撑。Toolkit 的成熟能力按缺口采用，避免替换现有组织与认证模型。订阅计费优先复用其他项目（已定位 D:/appspace/billandcharge）；OAuth/SSO 保留为近期后续路线，不作为本轮上线条件。运行门禁与评估证据见 ../../evidence/collaboration/CONTINUATION-2026-10-21.md。

2026-10-21 最新交付主线确认：多人协作文档、在线状态、评论与冲突合并；以 React、WebSocket、Yjs/CRDT 的端到端同步与一致性证据验收。白板保留为扩展，不替代或阻塞该主线；Redis 当前用于 OAuth 临时状态及 Socket.IO 广播，原生文档同步仍为单实例，不宣称已完成 Redis 跨实例正文同步。

2026-10-21 用户扩展范围：协作文档与实时白板都实现。最新范围、对象协议、冲突/权限及 WB01–WB06 验收见 [WHITEBOARD.md](WHITEBOARD.md)，覆盖下文旧的白板后续规划；历史文档验收不能替代白板验收。

你是本仓库的全栈产品工程师。请在 D:\appspace\collaboration 实现 CollabSpace：面向远程开发团队的项目协作文档。用户目标是完整、可验证的业务闭环，不能只交付计划、SDK 展示页或静态菜单。

先读根 AGENTS.md，再依次读 docs/collaboration/REQUIREMENTS.md、DESIGN.md、IMPLEMENTATION_NOTES.md 和 evidence/collaboration/ACCEPTANCE-2026-10-20.md，现场确认 Git/服务/证据。BASELINE.md 是首次复制的历史快照，仓库现已创建，不能据此重复建仓或覆盖已实现功能。根 README/REQUIREMENTS/DESIGN 中 TeamSpace 内容是继承底座。保留现有登录、组织、项目、RBAC、RLS、审计、IM；不重新搭建孤立应用，不把既有证据当新功能证据。

产品：项目下创建文档，邀请有效组织成员并授予 Owner/Editor/Commenter/Viewer，Tiptap + Yjs 多人正文编辑与选区光标，IndexedDB 离线缓存与重新鉴权后的差量同步，选区/文档评论和解决，命名版本、只读历史及恢复为新副本。默认不做白板、AI、匿名分享、计费扩展、原地回滚与双节点。

技术：沿用 Next.js + NestJS + Prisma + PostgreSQL；新增 apps/collab 原生 WebSocket 常驻服务和共享协议包。现有 Socket.IO 留给 IM，不能假定兼容 y-websocket。先核对 Node/pnpm/lockfile、Yjs/编辑器兼容版本并锁定依赖。Redis 仅在单节点闭环通过后作为 P1 扩展，不能代替数据库。

执行要求：
1. 盘点实际工作树、脚本、schema、认证/RLS和 gateway，记录基线问题；不要重置或覆盖无关改动。验证 project/doc/org 关联和过期身份，不信任客户端租户、角色和姓名。
2. 以 M0→M4 分段实现。先完成双账号真实编辑及 durable DB，再做离线、评论、版本与 UX。每阶段必须真实运行相应测试，不能停在方案。若依赖不可用，完成独立工作并明确具体阻塞。
3. 共用服务端授权，逐条更新检查有效权限。撤销/停用/归档与写入遵循同一锁序和线性化点。Viewer 伪造 sync-step2 也必须拒绝。连接 ticket 单次、短期、不可入 URL 日志，服务端无默认生产密钥。
4. 正文只走 Yjs 更新；更新先写本地 pending，再提交服务器，服务器 DB commit 后才 ACK 与广播。ACK 丢失安全重试，拒绝/持久化失败不显示已保存。只用 socket connected/synced 无法证明 durable save。
5. state vector + 差量同步；本地加载完再初始化编辑器，不能重复 seed。用 trackedOrigins 控制本地撤销；离线撤权后保留隔离草稿并停止上传。关注中文 IME、切组织销毁连接、内存泄漏、quota 失败与导出。
6. 评论使用 RelativePosition、原文 quote 和 orphan 状态，REST 幂等写入。历史保存独立不可变快照；恢复 materialize 为新内容、新 docId、新 Y.Doc 标识，仅恢复人默认可见；禁止 apply 旧快照模拟回滚。
7. 为新表实现迁移、复合外键、索引、RLS和非特权数据库角色测试。审计记录权限/版本等业务动作，不写正文/密钥到日志。
8. 把 REQUIREMENTS 的 AT01–AT11 转成真实测试与人工演示：多账号多上下文、两个组织、乱序重复更新、离线10分钟、刷新恢复、撤权竞态、anchor 删除、版本副本、ACK后杀进程、DB失败、20人热点/多房间压测。记录硬件/RTT/样本量/延迟分位，未达到目标如实报告。
9. 测试脚本从真实 package.json 读取；需要新命令就先实现脚本再执行，不能编造“已通过”。现有功能回归与新功能验收分别报告。截图仅辅助，不能代替持久化与权限证据。
10. 生产部署使用独立环境，新 DB/密钥/反代配置；复制来的 Terraform/部署脚本不能直接指向旧 TeamSpace 生产资源。真实外发、付款、生产资源变更需明确授权。

最终交付：可运行源码、迁移与合成 seed、环境变量示例（无真实值）、本地启动文档、完整 UI/API/WS 连接、英文 README、冲突/离线/权限 ADR、5 分钟演示路径、测试/故障/容量证据，以及 PASSED/BLOCKED/NOT_RUN 和尚未验证的生产门禁。先完成有证据的单节点版本，再讨论扩展。


2026-10-23 注册与组织邀请落地：个人定向通知、邀请接受/拒绝结果、加密邮件队列、受邀注册锁定邮箱与组织及真实邮箱验证边界见 [INVITATION-NOTIFICATIONS.md](INVITATION-NOTIFICATIONS.md)。验收禁止将 console 代替真实送达。侧栏一级与次级菜单统一14px。
