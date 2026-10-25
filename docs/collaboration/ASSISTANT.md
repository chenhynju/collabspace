# 协作助手：需求、设计与验收

2026-10-25后续用户已明确授权完整部署，正式入口 [协作助手](https://collabspace.purelamp.uk/assistant)。当前发布/线上验证及边界见 [发布记录](../../evidence/collaboration/RELEASE-2026-10-25.md)；下文2026-10-24的“无生产发布授权”描述仅记录最初集成时范围，已由后续授权扩展。

2026-10-24 用户授权从 `D:\appspace\portfolio-site` 选择适合协作的能力，复用 DeepSeek，并追加文字转语音、中英文双向翻译。用户另行明确授权“预览收件人、主题、正文后点击确认，通过现有 Resend 发信”；开发验证仅用发信替身。此要求覆盖历史“首版不做 AI”的范围描述，不授权生产发布或真实测试邮件。

## 范围与追溯

| 产品 / 业务 / 设计 / 验收 | 规则与结果 |
| --- | --- |
| P-A01 / BR-A01 / D-A01 / AT-A01 | 组织成员选择有 READ 权限的项目，上传 DOCX、文字型 PDF、TXT、MD 提取文字。文件最大5MB，PDF前30页，最多100000字，不写入现有附件。坏文件、扫描件、旧DOC明确拒绝。原文件不进入模型。 |
| P-A02 / BR-A02 / D-A02 / AT-A02 | 手动生成摘要与风险、会议行动项、项目邮件草稿。服务端独立校验当前组织成员和项目访问，生成后再次鉴权；模型不能写协作文档或执行工具。 |
| P-A03 / BR-A03 / D-A03 / AT-A03 | 中译英、英译中保留姓名/代码/链接/格式，1–1200字，超长拒绝，输出上限1200 token。达到输出上限显示不完整，禁止把截断当完整译文。 |
| P-A04 / BR-A04 / D-A04 / AT-A04 | 朗读生成结果，前4000字；支持暂停/继续/停止，中译英选择英文语音。退出、切组织、页面卸载取消；无语音能力时按钮禁用。浏览器/系统语音可能走其供应商在线服务，不调用 DeepSeek。 |
| P-A05 / BR-A05 / D-A05 / AT-A05 | 项目 WRITE 且组织 OWNER/ADMIN 或 `invite:send` 权限才可发信。手动编辑或生成后预览→确认→Resend；无配置拒绝，不把 console 当投递。每组织用户每小时20个新发送编号。 |
| P-A06 / BR-A06 / D-A06 / AT-A06 | 发送意图先持久化，再对外调用。编号绑定项目/收件人/主题/正文哈希；重放已受理编号只读回执，改正文用旧编号拒绝。超时保留 UNKNOWN；至少一分钟后相同编号/内容手动重试，23小时后停止重试防止供应商幂等窗口外重复。 |
| P-A07 / BR-A07 / D-A07 / AT-A07 | 密钥仅服务端，DeepSeek按需调用，无自动重试。摘要前6000字，输出700 token；所有模式共用每组织用户每小时10次的单进程限额及单并发。15分钟结果缓存按组织、用户、项目、模式、实际输入隔离。 |

## 复用与取舍

源项目只读检查：`src/lib/summarizer.ts`、`src/lib/tts.ts`、`src/app/api/summarize/route.ts`、`src/components/admin/MailComposer.tsx`。采用其输入限长、显式生成、结果容错、邮件预览/正文转义、浏览器语音降级思路；不搬 CMS 管理员身份、模型渠道数据库或源工程路由。

沿用本项目 JWT、OrgContextGuard、ResourcePolicyService、Prisma `withOrg`、审计、Resend 标签和验签回调。DOCX/PDF 解析新增锁定依赖 `mammoth@1.11.0`、`pdf-parse@1.1.1`。解析在无窗口子进程执行，10秒超时、128MB V8堆限制、单进程最多2个解析；DOCX额外检查ZIP目录总解压声明大小20MB/2000条。V8堆限制不是操作系统级RSS隔离。

AI 限额/并发/缓存当前在单进程内存，重启清空，多实例分别计数，**不是持久账单预算**；不可据此承诺组织硬费用上限。生产如需严格预算，应迁入共享持久计数并验证并发。正文不会写审计，结果缓存最多200份；进程内缓存15分钟失效并在后续请求清理。上传不会自动调用模型。

发送记录只保存组织/actor/项目、内容哈希、状态和供应商ID，不保存收件人及正文。已确认但未核查的发送草稿保存在当前浏览器 `sessionStorage`，键含用户与组织，刷新可恢复；退出时清理该用户草稿。关闭浏览器后若草稿丢失，应按发送记录/供应商记录核查，不新建相同邮件盲发。

邮件状态：`SENDING → ACCEPTED / UNKNOWN`，`UNKNOWN → SENDING` 仅人工同内容重试。ACCEPTED 只是服务商受理，不是送达。`project_mail` 标签进入原有验签回调记录；本轮发送列表不展示 delivered/bounced 的关联状态。供应商24小时幂等保留依据 [Resend官方契约](https://resend.com/docs/dashboard/emails/idempotency-keys)；真实投递/退信、实际重试和收件方反垃圾策略仍须上线环境单独验收。

## 接口

均继承全局JWT和组织守卫；组织来自服务端成员反查，忽略客户端伪造组织字段。

| 接口 | 行为 |
| --- | --- |
| GET `/assistant/status` | 返回是否有服务端AI/邮件配置及浏览器语音模式，不返回密钥 |
| POST `/assistant/extract` | multipart `projectId,file`，权限校验后解析，再校验后返回文字 |
| POST `/assistant/generate` | `{projectId,text,mode}`，mode为summary/actions/email/translate-en/translate-zh |
| POST `/assistant/mail` | `{projectId,requestId,confirmed:true,to,subject,text}` 严格校验，持久意图、供应商调用、记录回执 |
| GET `/assistant/mail?projectId=...` | 返回当前用户当前组织该项目最近20条发送记录 |

## 运行与发布

1. `pnpm install --frozen-lockfile`。
2. 服务端 `apps/api/.env` 配置 `DEEPSEEK_API_KEY`；本次已从源工程复用到被Git忽略的本地配置，不提交值。生产沿用既有环境配置体系，禁止放入 `NEXT_PUBLIC_*`。
3. 邮件沿用 `EMAIL_PROVIDER=resend`、`RESEND_API_KEY`、`EMAIL_FROM`。不配置时不能真实发送；开发固定 `EMAIL_PROVIDER=console`。
4. 新增表见 `packages/collab-store/assistant.sql`，必须管理员运行，已接入 `pnpm collab:migrate`。既有部署可仅在事务内应用该新增SQL；RLS开启且强制，复合外键约束项目属于相同组织。运行角色支持既有teamspace_app/collabspace_app。不得替换生产连接或自动执行生产迁移。
5. 构建：`pnpm --filter @teamspace/api run build`、`pnpm --filter @teamspace/web run build`。浏览器入口 `/assistant`，侧栏“项目协同 → 协作助手”。

### English walkthrough

Open **Collaboration assistant** in the project sidebar. Choose an accessible project, upload a DOCX/text PDF/Markdown file or paste meeting notes. Review the extracted text, then explicitly generate a summary, action list, email draft or Chinese/English translation. Long translations must be split into chunks; incomplete output is marked. Read the result aloud without an LLM call. To email it, review the recipient, subject and body, then confirm. A provider receipt means acceptance, not delivery. Unknown outcomes retain the same request ID for safe manual investigation/retry. No real test emails or production deployment are part of this change.

## 验证与续做

实际命令、环境、PASSED/BLOCKED/NOT_RUN见 [本轮验收](../../evidence/collaboration/ASSISTANT-2026-10-24.md)。测试脚本中的邮件供应商调用均为替身，不是真实发信成绩。
