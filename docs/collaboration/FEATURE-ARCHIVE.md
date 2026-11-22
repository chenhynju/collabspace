# CollabSpace 功能归档

> 更新日期：2026-11-22 ｜ 生产站点：https://collabspace.purelamp.uk
> 当前发布：前端 `collabspace-ca5sq74m2-purelamp.vercel.app`（已别名）；API 镜像 `collabspace-api:api-r20261121-11`（`sha256:527038532857a3a221902719833c0d17fcc7cc15a9c977ed0b2d900d59b1a126`）；提交 `4da42cd`；标签 `collabspace-20261122-smart-guides`、`collabspace-20261122-multiselect`、`collabspace-20261122-arrow`、`collabspace-20261122-docs`、`collabspace-20261121-board-ai`。
> 本文是“已完成功能”的唯一归档入口。功能完成并通过验收后，必须同时更新本文、对应 evidence 和 README 状态；未验证的内容不得写成已上线。

## 状态口径

| 状态 | 含义 |
| --- | --- |
| 已上线 | 生产可用，有验收证据；边界见“限制”列 |
| 已上线（受限） | 主链路可用，但依赖外部账号/配置，或只开放部分场景 |
| 本地已验收 | 代码与本地/隔离环境通过，生产未发布 |
| 生产关闭 | 代码存在，但功能开关关闭、入口不展示 |
| 未实现 | 设计或占位存在，没有可交付能力 |

## 1. 身份、组织与权限

| 能力 | 状态 | 证据 | 限制 / 待办 |
| --- | --- | --- | --- |
| 邮箱注册、验证、登录、忘记密码、重置密码 | 已上线 | `AUTH-REGRESSION-BROWSER-2026-11-12.md`、`ACCOUNT-SECURITY-2026-10-23.md` | 邮件依赖 Resend；验证邮件可能进垃圾箱 |
| Google / GitHub OAuth | 已上线（受限） | `OAUTH-SETUP-MEMO.md`、`auth-regression-20261112` | 需在环境配置对应 Client ID/Secret；未配置时入口不可用 |
| 登录限流（IP+邮箱） | 已上线 | `AUTH-REGRESSION-BROWSER-2026-11-12.md` | 单实例内存计数；水平扩容需改 Redis |
| 多组织、工作区、项目、成员、部门、岗位、角色 | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | 所有业务查询必须带服务端校验的 organization_id |
| 邀请成员、撤回、过期、邮件投递 | 已上线 | `INVITATIONS-2026-10-23.md` | 受邀邮箱锁定；7 天有效 |
| 角色权限矩阵、菜单/按钮权限 | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | 前端隐藏按钮不等于权限控制，服务端仍校验 |
| 最后一个有效 Owner 保护 | 已上线 | 需求 BR-07、验收 AT-07 | 任何降级/移除路径都必须经过服务端事务 |
| 审计日志（actor、资源、前后差异、trace_id） | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | 敏感字段脱敏；不记录正文和二进制 |

## 2. 项目与内容协作

| 能力 | 状态 | 证据 | 限制 / 待办 |
| --- | --- | --- | --- |
| 项目空间：工作区、项目、成员、状态、归档 | 已上线 | `UNIFIED-WORKSPACE-2026-10-24.md`、`WORKSPACE-UX-2026-10-25.md` | `/workspaces` 保留兼容跳转 |
| 富文本文档：标题、列表、任务、引用、链接、图片、公式 | 已上线 | `RICH-TEXT-2026-10-21.md`、`MATH-2026-10-24.md` | 每文档累计 20 张图 / 20MB；公式为 LaTeX |
| Markdown 源码协作 | 已上线 | `MARKDOWN-RELEASE-2026-10-22.md` | 源码类上传 ≤200KB |
| 文档 ACL：Owner / Editor / Commenter / Viewer | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | 组织管理员不天然可读正文；需显式授权 |
| 实时多人编辑、选区/光标、在线成员 | 已上线 | `REALTIME-2026-10-21.md` | 单 collab 实例；跨实例正文同步未验证 |
| 离线续写、重连合并、本地与服务端保存状态 | 已上线 | `REALTIME-2026-10-21.md` | 首次离线启动应用壳不在 P0 |
| 评论、回复、解决/重开、原文删除后的未定位列表 | 已上线 | `ACCEPTANCE-2026-10-20.md` | 评论为纯文本，5000 字上限 |
| 命名版本、只读预览、恢复为副本 | 已上线 | `ACCEPTANCE-2026-10-20.md` | 恢复生成新文档，不覆盖当前协作文档 |
| 自动快照时间轴（每分钟至多一份） | 已上线 | `SNAPSHOT-TIMELINE-2026-10-29.md` | 单文档完整状态上限 5MiB |
| 撤权后冻结已建立的编辑会话 | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | 已下载内容无法从离线设备“收回” |

## 3. Office 与文件

| 能力 | 状态 | 证据 | 限制 / 待办 |
| --- | --- | --- | --- |
| DOCX / XLSX / PPTX 在线编辑 | 已上线 | `OFFICE-ONLINE-2026-10-22.md`、`OFFICE-PRODUCT-2026-10-25.md` | 依赖 ONLYOFFICE 引擎；复杂对象/宏有边界 |
| 保存到服务器、服务器版本、命名检查点 | 已上线 | `OFFICE-PARITY.md` | 应用是 ACL/版本权威，Office 引擎是细粒度编辑权威 |
| 另存私有副本、导出 PDF | 已上线 | `OFFICE-PRODUCT-2026-10-25.md` | 副本权限默认仅恢复人可见 |
| 图片先本地压缩再上传 | 已上线 | `PPT-IMAGE-PERFORMANCE-2026-10-25.md` | 可选 1280px 等预设 |
| 会话冻结与恢复候选 | 已上线 | `OFFICE-ONLINE-2026-10-22.md` | 防止旧会话覆盖他人成果 |
| 文件库、上传、下载、项目归档、分享 | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | 上传需 `file:manage` 权限 |

## 4. 白板、Mermaid 与图表

| 能力 | 状态 | 证据 | 限制 / 待办 |
| --- | --- | --- | --- |
| Mermaid 源码 / 图元开关式视图 | 已上线 | `MERMAID-2026-10-21.md`、`BOARD-REVIEW-COMMENTS-2026-11-22.md` | 源码为权威；复杂语法有渲染边界；开关只改变展示 |
| 自由画布：矩形、椭圆、便签、箭头、思维主题 | 已上线 | `WHITEBOARD.md`、`BOARD-AI-INTERACTION-2026-11-21.md` | 单白板最多 500 个图元；基础工具图标已补齐 |
| 箭头 / 连线：图元间绑定连接线 + 空白处自由箭头 | 已上线 | `BOARD-AI-INTERACTION-2026-11-21.md`、`BOARD-ARROW-FREE-2026-11-22.md` | 自由箭头不绑定图元；AI 连线仍只支持绑定两个图元 |
| 图元拖拽、改字、连接点拖线、目标高亮、连接线样式 | 已上线 | `MERMAID-CONNECT-2026-10-26.md`、`BOARD-AI-INTERACTION-2026-11-21.md` | 任意 Mermaid 语法/坐标回写仍有限制 |
| 多选、框选、组拖、六向对齐、水平/垂直分布、批量复制/删除 | 已上线 | `BOARD-MULTI-SELECT-2026-11-22.md` | 连接线/自由箭头不参与对齐；组拖只移动图元 |
| 智能对齐参考线、图元层级置顶/置底/上移/下移 | 已上线 | `BOARD-SMART-GUIDES-2026-11-22.md` | 参考线只做边缘/中心吸附；连接线固定显示在图元之上 |
| 图元级评论、回复、解决/重开与评审模式 | 已上线 | `BOARD-REVIEW-COMMENTS-2026-11-22.md` | 复用文档评论权限；图元删除后评论保留但不可定位；未做 @提及与通知 |
| 流程图 / 思维导图模板、自动布局 | 已上线 | `DIAGRAMS-2026-10-21.md` | 模板放置空间不足时有提示 |
| 业务图表模板库与图元目录 | 已上线 | `BUSINESS-DIAGRAMS-2026-10-22.md` | 覆盖高频场景，不宣称全行业 |
| 导入/导出 Mermaid、SVG、PNG | 已上线 | `WHITEBOARD.md` | 导入为追加；导出可能简化样式 |
| 白板 AI Agent（新增图元、改字、移动、连线、自动布局） | 已上线（受限） | `BOARD-AI-INTERACTION-2026-11-21.md`、`AGENT-OFFICE-WHITEBOARD.md` | 单次最多 20 个操作；不支持删除、改颜色/线型；需用户确认 |
| 项目数据联动、表格驱动出图 | 未实现 | 竞品分析结论 | 下一阶段候选，见 `DIAGRAMS.md` 的后续章节 |

## 5. 消息、通知与邮件

| 能力 | 状态 | 证据 | 限制 / 待办 |
| --- | --- | --- | --- |
| 单聊、群聊、创建会话、群成员 | 已上线 | `IM-2026-10-20.md` | 需要 `im:view` 权限 |
| 已读回执、输入中状态 | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | WebSocket 断线时降级轮询 |
| 图片、文件消息、附件权限 | 已上线 | `IM-2026-10-20.md` | 附件沿用项目/组织权限 |
| 语音听写转文字（录音结束识别） | 已上线 | `ui-editorial-2026-11-21/voice-elevenlabs-online.json` | ElevenLabs Scribe v2；非流式；单次 60 秒 / 4000 字 |
| 消息朗读 | 已上线（降级） | `UI-REDESIGN-AGENT-2026-11-20.md` | IM 使用浏览器系统朗读；不是服务端 TTS |
| 站内通知中心、个人通知 | 已上线 | `INVITATIONS-2026-10-23.md` | 个人通知不依赖先加入目标组织 |
| 注册验证、邀请、项目邮件 | 已上线 | `MAIL-ROUTING-2026-10-24.md`、`RELEASE-MAIL-SINK-2026-11-14.md` | Resend 真实外发；合成域名只落日志 |
| 公告与已读范围 | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | 按组织权限展示 |

## 6. AI、搜索与语音

| 能力 | 状态 | 证据 | 限制 / 待办 |
| --- | --- | --- | --- |
| 协作助手：摘要、行动项、翻译、写邮件 | 已上线 | `ASSISTANT-2026-10-24.md` | 依赖 DeepSeek；邮件确认后才发送 |
| AI 工作助理：规则规划 + 模型问答 | 已上线 | `UI-REDESIGN-AGENT-2026-11-20.md` | 写操作只返回计划，用户确认后执行 |
| 项目内 AI 生成文档/白板内容 | 已上线（受限） | `AGENT-OFFICE-WHITEBOARD.md`、`BOARD-AI-INTERACTION-2026-11-21.md` | 白板支持 add/update/move/connect；受选区、权限、幂等和审计约束 |
| 全局搜索（页面、项目、文档、消息等） | 已上线 | `ui-editorial-2026-11-21`、`REVIEW-RELEASE-2026-10-30.md` | 结果受组织和资源权限过滤 |
| ElevenLabs 语音转文字（Scribe v2） | 已上线 | `ui-editorial-2026-11-21/voice-elevenlabs-online.json` | 生产已配置；60 秒 / 4000 字；无自动重试 |
| ElevenLabs 文字转语音（multilingual v2） | 已上线 | `ui-editorial-2026-11-21/voice-elevenlabs-online.json` | 生产已配置；输出 16kHz WAV |
| 预设/卡通数字人、基础口型预览 | 已上线（受限） | `PERSONA-MOTION.md`、`UI-VOICE-PERSONA-REGRESSION-2026-11-17.md` | 第三方技术样例，非 20 款定制成品 |
| 私有照片/视频素材草稿 | 已上线 | `VOICE-PERSONA-2026-10-25.md` | 仅本人可见；≤20MB、最多 3 个、7 天过期；不外发、不训练 |
| 真人数字人视频生成 | 未实现 | `apps/api/src/modules/voice/avatar-provider.ts` | 未接供应商；不会伪造成功或可播放结果 |

## 7. 界面、设置与体验

| 能力 | 状态 | 证据 | 限制 / 待办 |
| --- | --- | --- | --- |
| 顶栏 + 抽屉导航 + 右侧 AI 助理 | 已上线 | `UI-REDESIGN-AGENT-2026-11-20.md` | 沉浸式文档/Office 编辑页隐藏顶栏 |
| 编辑风 / 经典浅色双主题 | 已上线 | `ui-editorial-2026-11-21/theme-*.png` | 经典主题是 token 级还原，不是组件级回滚 |
| 个人资料与显示姓名修改 | 已上线 | `ui-editorial-2026-11-21/theme-profile.png` | 仅姓名；邮箱与头像不在范围 |
| 语音与数字分身设置合并到 `/settings/persona` | 已上线 | `ui-editorial-2026-11-21/theme-voice-persona.png` | IM 只保留一个入口 |
| 响应式与键盘可达性 | 已上线（持续改进） | `UI-REDESIGN-AGENT-2026-11-20.md` | 移动端以阅读和基础编辑为主 |
| 白板工具栏、属性面板、文档工具栏统一 | 已上线 | `BOARD-AI-INTERACTION-2026-11-21.md` | 使用同一套圆角/token 样式；仍有少量专项控件保留原布局 |

## 8. 管理与运维

| 能力 | 状态 | 证据 | 限制 / 待办 |
| --- | --- | --- | --- |
| 系统管理：菜单、字典、参数、登录日志 | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | 仅 OWNER / 授权角色可见 |
| 监控：在线用户、服务、缓存、任务、数据库会话 | 已上线 | `REVIEW-RELEASE-2026-10-30.md` | 指标来自现有服务，不替代外部 APM |
| 套餐与订阅沙盒 | 已上线（沙盒） | `REVIEW-RELEASE-2026-10-30.md` | Stripe / PayPal 仅 sandbox，收款入口隐藏 |
| 项目会议（预约、聊天、RTC） | 生产关闭 | `MEETINGS.md` | `MEETINGS_ENABLED=false`，入口不展示 |
| 生产部署、健康检查、备份、回滚 | 已上线 | `RELEASE-AUTH-HARDENING-2026-11-12.md`、`REVIEW-RELEASE-2026-10-30.md` | 单实例 WS；正式备份还原演练仍待做 |

## 9. 已知限制汇总

- 实时正文同步为**单 collab 实例**，跨实例/跨地域未验证。
- 单文档完整状态上限 5MiB；WS 单帧 256KiB；白板最多 500 个图元。
- 支付为沙盒；会议生产关闭；真人数字人视频未接供应商。
- 语音为**录音结束后 REST 识别/合成**，不是流式字幕；无自动回退和自动重试。
- 白板支持图元间绑定连接线和空白处自由箭头；自由箭头不绑定图元，AI 连线仍只支持绑定。AI 单次最多 20 个操作，不支持删除、改颜色/线型。
- 多选只对齐/复制图元；连接线和自由箭头不参与对齐，组拖时自由箭头不跟随。
- 生产演示数据为合成账号，不代表真实客户或真实业务指标。

## 10. 归档规则

1. 功能通过验收后，在本表新增一行，写清“状态、证据、限制”。
2. 证据必须能打开：截图/JSON/验收记录放在 `evidence/collaboration/`，不要只写“已测试”。
3. 状态变化（例如从“本地已验收”变为“已上线”）要更新本表，不另起新文档。
4. 未通过、未运行、供应商未配置的项，保留在“限制/待办”，不得删除。
5. 每次发布在本文顶部更新发布 ID、镜像、提交与标签。
