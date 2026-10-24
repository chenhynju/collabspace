# CollabSpace — 详细设计 v1

2026-10-24：多项目 Resend 回调验签、业务分流、持久化队列与其他项目适配补丁，见 [邮件回调路由](MAIL-WEBHOOK-ROUTING.md)。

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

本文件是初始设计基线，与同目录 REQUIREMENTS.md 的 BR/AT 对应。2026-10-20 的实际 API、批量提交和已知缩减见 IMPLEMENTATION_NOTES.md；设计指标不是验收成绩。

## D01 架构与选型

延续 apps/web（Next.js）与 apps/api（NestJS）及既有 Prisma/RLS/审计。新增 apps/collab（TypeScript 原生 WebSocket 同步服务）与 packages/collab-protocol（帧定义、schema、版本、错误码）。Web 采用 Tiptap/ProseMirror + Yjs，IndexedDB 保存离线状态；编辑器 extension、Yjs、y-prosemirror 等锁定兼容版本后再实现。首版一个 collab 实例，PostgreSQL 为持久化事实源。

不把 y-websocket 帧塞进 Socket.IO：二者线协议不同。原有 IM Socket.IO 保留；正文用独立 /collab WebSocket 和受测试的 Yjs sync adapter。采用成熟 y-protocols，不自造 CRDT；加入自定义更新 envelope 与 durable ACK，标准 provider 的 synced 不直接等于持久化。

Liveblocks 可减少运维，但本项目需要公开同步/持久化/恢复证据，且已有后端权限基础，所以主线选择自管 Yjs。该选择增加协议与运维成本；不同时维护两套 provider。Redis 非首版正文数据库：P1 仅用于跨实例通知和可丢弃 presence，Pub/Sub 丢消息靠数据库增量重放恢复。

## D02 权威与一致性

- 正文仅由 collab 授权接收 Yjs 更新并写入数据库，REST 不接受全量正文覆盖。
- 元数据/ACL/评论/命名版本由 NestJS 授权事务写入；同一资源不建立双写路径。
- 正文最终收敛不意味着满足业务权限或语义正确。并发插入按 CRDT 标识确定顺序；同段改写可能出现用户需整理的内容，产品不承诺理解作者意图。
- 标题/评论编辑使用 revision + If-Match，冲突返回 409 并保留本地草稿。ACL 与生命周期使用服务端事务。
- Undo 使用 trackedOrigins 和本地 UndoManager；远端事务不进入本地撤销栈。初始化内容由服务端生成一次，客户端不在每次连接时写 seed。

## D03 数据模型

以下为拟新增模型，所有资源查询带 organizationId，使用现有 withUser/RLS 机制；迁移必须有非 owner 数据库角色测试。关系使用含 organizationId 的复合唯一键/外键，避免把 A 组织 doc 指向 B 项目。

| 模型 | 关键字段/约束 |
| --- | --- |
| CollabDocument | id, organizationId, workspaceId, projectId, title, status ACTIVE/ARCHIVED, revision, aclEpoch, createdBy, createdAt, updatedAt |
| DocumentGrant | organizationId, documentId, userId, role；unique(documentId,userId)；索引 org/user |
| DocumentUpdate | organizationId, documentId, seq bigint, updateId UUID, actorId, clientSessionId, bytes bytea, checksum, createdAt；unique(documentId,updateId)，unique(documentId,seq) |
| DocumentCheckpoint | documentId, organizationId, throughSeq, encodedState bytea, stateVector bytea, schemaVersion, checksum；unique(documentId,throughSeq) |
| DocumentVersion | id, organizationId, documentId, name, throughSeq, 独立不可变 encodedState, schemaVersion, createdBy, createdAt；不得仅指向将被压缩的增量 |
| CommentThread | id, organizationId, documentId, anchorStart/End 编码后的 RelativePosition, quote, state OPEN/RESOLVED, revision, createdBy |
| Comment | id, threadId, organizationId, body plain text, revision, createdBy, createdAt, editedAt |
| IdempotencyRecord | orgId, actorId, scope, key, requestHash, resultRef；唯一键及有效期；相同 key 不同请求返回 409 |

seq 是服务端提交序列而非 CRDT 时钟，不能拿它决定正文内容覆盖。Presence 不写历史业务表。复用 OperLog 记录权限/版本/归档/评论状态，不记录每个按键及正文到普通日志。

## D04 授权与撤销竞态

API 签发 60 秒、单次使用的连接 ticket，绑定 user/org/project/doc/role/aclEpoch/session/nonce；签名密钥无开发默认值。浏览器先建立 TLS WS，在 5 秒内发 auth 帧；未授权前不加载正文、不允许 sync。限制未认证连接总量；ticket 不进 URL、访问日志、localStorage。nonce 由数据库原子消费。

握手、重连、增量写入、同步读取、历史与评论都校验账号/组织/项目/文档状态与有效授权。文档写入事务先按统一顺序锁定账号、membership、project、document、grant 相关行并检查权限；撤销/停用/归档事务取得相同授权行锁并递增相应 epoch。这样定义线性化点：撤销提交之后开始提交的更新不再成功。所有入口须共用锁序，禁止仅靠房间缓存或 30 秒定时复校。

读授权同样在数据读取时检查；已在撤销提交前发送到网络的数据无法收回。单节点撤销主动断开，周期复校只作兜底。P1 跨节点失效通知加 outbox，并继续由 DB 写入检查保证安全。多级权限锁竞争需在 M3 测量，必要时再设计服务端授权栅栏，不提前宣称高吞吐。

## D05 协议与 durable ACK

帧头包含 protocolVersion/type/requestId；更新 envelope 含 updateId、docId、schemaVersion 和 Yjs 二进制 payload。userId/租户不信任客户端。白名单限制客户端可发送的 sync message subtype，Viewer 只能请求服务器 diff，不能通过 sync-step2 绕过写权限。

1. 加载权限 → 加载最近 checkpoint + throughSeq 之后所有更新 → 状态向量协商。
2. 本地编辑生成更新，先持久化 pending envelope 到 IndexedDB，再发送；不将远端更新重新生成为新的本地 pending。
3. 服务端对同文档串行排队，检查帧长、速率、schema 兼容及授权；对候选副本 apply/验证，禁止先污染权威内存。
4. DB 事务写 DocumentUpdate、分配单调 seq；同 updateId 重试先核对 checksum，不重复写。
5. 事务 commit 后更新权威内存、发送 ACK(updateId,seq) 并向其他成员广播。commit 后进程退出但 ACK 丢失，由重试查询原记录确认。内存应用失败时使房间失效并从 DB 重载，不继续服务旧状态。
6. 客户端收到 durable ACK 后清 pending；同步完成必须同时满足差量协议完成、所有本地 pending 已 ACK 和未发生拒绝。

DB 写失败不广播、不发成功 ACK。网络超时指数退避带抖动（1–30 秒），重连重新拿 ticket 与权限；不能永久复用过期身份。待发送队列 >5 MiB 时暂停编辑并提供草稿导出，避免无限内存增长。

## D06 离线与本地安全

IndexedDB key = 环境/账号/组织/docId/schemaVersion；必须等待本地 hydration 再创建编辑器，避免初始内容重复。缓存包括 Y.Doc、pending update envelope 和必要元数据；y-indexeddb 的 synced 仅表示本地载入。

P0 支持已加载页面掉线、刷新后在网络恢复时继续；浏览器完全离线首次重启应用壳需 Service Worker，列 P1。IndexedDB quota/隐私模式失败时 UI 明确“本地保存失败”，保留内存草稿和导出入口。注销销毁 provider/ydoc 并清账号缓存；组织切换释放连接，不混用 doc 实例。

重连权限撤销：服务端拒绝，停止上传，旧草稿隔离只允许本地导出；用户不能将其重新合并到已失权文档。档案删除与 CRDT epoch 不跨越混合；新副本使用新 docId。

## D07 评论与版本

选区评论保存 Yjs RelativePosition 起止点及 quote，不保存易漂移的字符 index。RelativePosition 基于对应 Y.Doc lineage；解析为空或原文删除则转为未定位评论，quote 仅作上下文且跟随文档 ACL。评论纯文本，链接清洗，字符数限制 5000；提交有幂等键，状态切换使用 revision。评论通过 REST 持久化并用通知事件刷新；漏通知时重新拉取，以 DB 为准。

命名版本请求由 collab 串行屏障处理：读取已提交 throughSeq，生成对应完整 Yjs 状态及可预览内容，保存 schemaVersion。客户端有未 ACK 编辑时禁用创建版本。预览从不可变快照构建独立只读 Y.Doc，不连接原房间。

“恢复”明确为创建副本：从旧版本 materialize 编辑器内容，赋新 docId、重新创建 Y.Doc 与全新 CRDT 标识，ACL 默认恢复人 Owner，不复制评论锚点。不能把旧快照 apply 到当前文档当回滚，也不能把旧 CRDT ID 直接复用成恢复副本。原地恢复留待后续专门 epoch/协作者迁移设计。

## D08 API 与界面映射

复用 /api 前缀及现有认证规范，实施前核对全局 prefix。

| 方法与路径 | 权限/结果 |
| --- | --- |
| GET/POST /organizations/:org/projects/:project/documents | 项目有效、显式可见；分页列表/创建初始 owner |
| GET/PATCH /documents/:id | 可读/Editor；元数据 revision，禁止正文覆盖 |
| POST /documents/:id/archive | Owner；写审计、关闭写入 |
| GET/PUT /documents/:id/grants | Owner；最后 owner 检查、epoch、审计 |
| POST /documents/:id/session-ticket | 可读；返回 ticket、expiry、protocolVersion、WS URL |
| GET/POST /documents/:id/threads | 可读/Commenter；游标分页/幂等创建 |
| POST /threads/:id/comments；PATCH /threads/:id | Commenter；追加、解决/重开 |
| GET/POST /documents/:id/versions | 可读/Editor；分页/命名不可变快照 |
| GET /versions/:id/preview；POST /versions/:id/restore-copy | 可读/Editor 且可创建项目文档；只读预览/幂等创建新文档 |

404 隐藏无权资源存在性；401 身份过期；409 revision/幂等冲突；413 过大；429 限流；503 依赖失败。WS 错误码与 UI 状态一致，不在 error 中泄露内容和 ticket。web 新增项目 Documents 入口及 /projects/[projectId]/documents/[docId]；客户端 provider 负责生命周期，编辑器仅消费文档状态。

## D09 容量、压缩与运维

初始限制：单帧 256 KiB（完整同步按协议分块），文档完整编码 5 MiB，20 活跃编辑会话/文档，正文更新 20 帧/秒/会话且有字节预算；awareness 最多 10 Hz、每会话 2 KiB，慢客户端发送缓冲 >1 MiB 时丢弃旧 presence，正文不丢弃，断线后重同步。限制都是起始配置，测量后调整。对解码 CPU/内存设置隔离与预算，异常 Yjs 更新不应阻塞所有房间。

每 1000 条更新或 5 分钟生成 checkpoint：固定 throughSeq N，事务提交 checkpoint，验证重建后才能清理 <=N 的增量；保留去重记录覆盖离线重试窗口。命名版本独立留存，不依赖增量。P0 不做自动永久删除历史，设置存储上限并提示；保留周期由后续产品决策确定。

collab 部署到支持长连接的常驻容器；Next.js 可单独托管，禁止假定 serverless request 支持常驻房间。TLS、Origin 白名单、反向代理 WS upgrade/空闲超时/心跳配置明确；liveness 与 readiness 分开。优雅终止先停止新连接、完成已接收写入、关闭会话；紧急退出靠 durable DB 恢复。生产新建独立 DB/对象存储/密钥，旧部署文件仅作参考。

指标：连接数、房间数、更新接收到 commit/ACK 延迟、同步 backlog、拒绝数、重连时间、checkpoint 时间、内存、DB 错误、event-loop lag。日志用 traceId/docId/sessionId，不记录正文和二进制内容。告警与备份恢复演练列为发布门禁。

P1 双节点：DB 为共同日志；Redis publish 携带 docId/seq，订阅者按 seq 补读 DB；定期查高水位修复漏消息。checkpoint 单写者需数据库租约与 fencing。未通过跨节点故障测试之前只发布单节点容量声明。

## D10 实现与验证顺序

M0 运行真实现有 scripts，检查 auth/权限/RLS/项目关联，扫描复制品凭据，分离原工程证据。M1 建模型/RLS、ticket、协议、durable persistence、两浏览器编辑；必须先通过 AT01/02/08/09。M2 接入 IndexedDB、评论、版本（AT04–07）。M3 故障注入、热点压测、IME/无障碍、清理监听器（AT03/10/11）。M4 独立部署、TLS/反代/备份恢复、英文 demo。

测试分层：Yjs convergence/Undo/anchor 语义测试；真实 PG 的权限/事务/重建测试；独立浏览器上下文 E2E；网络断开/进程 SIGKILL/ACK 丢失/DB 故障注入。哈希相同不能单独证明业务正确，比较编辑器语义树、用户可见内容及权限副作用。每份报告标明 commit、环境、数据规模、精确命令及 PASSED/BLOCKED/NOT_RUN。

## 官方技术依据

- [Yjs updates](https://docs.yjs.dev/api/document-updates)：更新合并及 state vector。
- [Yjs 离线](https://docs.yjs.dev/getting-started/allowing-offline-editing)：IndexedDB 与离线页面壳的区别。
- [Yjs RelativePosition](https://docs.yjs.dev/api/relative-positions)：选区锚定。
- [y-websocket](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket)：独立协议与服务端 provider 参考；本设计 durable ACK 需要额外实现与测试。


## Office 二进制协作扩展（2026-10-22）

Office 引擎为细粒度编辑权威，应用为 ACL/持久版本权威；独立 generation、每客户端 lease UUID、活动 epoch、保存 receipt 与事务栅栏防止旧回调覆盖。禁止 OFFICE 资源进入 Yjs 同步/恢复路径，父项目 READ 限制所有子文档写入。详细设计与拒绝/恢复证据见 OFFICE-INTEGRATION-2026-10-22.md。


## Office 线上交付（2026-10-22）

生产Office使用既有API域名HTTPS子路径与精确前缀下载映射；后端通过受限无特权SSH账号访问新机回环引擎。前端Markdown列表增加有限网络重试、失败提示与手动重载，组织变更时取消旧重试。


### 2026-10-23 注册邀请与个人通知

新增 INV01–INV06，业务、状态机、数据库权限与邮件交付边界见 [INVITATION-NOTIFICATIONS.md](INVITATION-NOTIFICATIONS.md)。核心协作与资源 ACL 保持既有权威模型；个人通知不依赖先加入目标组织。侧栏一级、次级菜单统一14px。
