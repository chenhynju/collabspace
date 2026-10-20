# 可直接交给开发 Agent 的 Prompt

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
