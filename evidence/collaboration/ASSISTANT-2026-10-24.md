# 协作助手本轮验收 — 2026-10-24

## 环境与范围

- 工作目录 `D:\appspace\collaboration`，Windows / Node 22.20.0，已有 Next.js 14.2.35 / NestJS。源项目 `D:\appspace\portfolio-site` 只读检查；无生产部署、生产迁移或真实邮件测试。
- 开始时存在大量协作空间/Office相关共享改动；本轮保留它们。期间其他聊天提交了共享工作；没有重置或覆盖这些提交。以当前源码及以下命令为本轮证据，不引用历史Office/协作成绩替代。
- 独立合成环境 `.test-runs/assistant-verify2`：Web43220 / API43221 / PostgreSQL5560 / Collab43222。非特权运行角色 `teamspace_app`，两个合成组织，邮件 `console`。邮件持久化验收中的供应商为注入替身。
- 根侧栏新入口“协作助手”，路由 `/assistant`。契约及P/BR/D/AT追溯见 [ASSISTANT.md](../../docs/collaboration/ASSISTANT.md)。

## PASSED

| 检查 | 精确命令/行为 | 结果 |
| --- | --- | --- |
| API构建 | `pnpm --filter @teamspace/api run build` | PASS，含翻译、PDF修复后的构建 |
| Web类型 | `pnpm --filter @teamspace/web exec tsc --noEmit` | PASS，含新增翻译 |
| Web生产构建 | PowerShell设置 `NEXT_DIST_DIR=.next-assistant-final-2239` 后 `pnpm --filter @teamspace/web run build` | PASS，38个路由，包含 `/assistant`；只有既有register Hook及MessageBubble图片警告 |
| API与邮件专项 | `node --test apps/api/tests/assistant.test.cjs apps/api/tests/project-mail.test.cjs apps/api/tests/mail-tags.test.cjs apps/api/tests/mail-webhook.test.cjs` | 15项：14 PASS、1既有可选PG回调测试SKIP、0失败 |
| 真实非特权数据库 | 设置 `ASSISTANT_TEST_CONFIG=.test-runs/assistant-verify2/config.json` 后 `node --test apps/api/tests/assistant-postgres.test.cjs` | 1/1 PASS；意图/回执持久化、重放不重复调用、正文哈希绑定、无组织上下文及异组织RLS不可见、异项目拒绝 |
| 浏览器业务流程 | 设置 `COLLAB_BROWSER_CONFIG=.test-runs/assistant-verify2/config.json` 后 `pnpm exec playwright test tests/browser/assistant.spec.cjs --reporter=list --output=.test-runs/assistant-browser` | 1/1 PASS，18.7秒；真实登录、项目列表/授权、上传MD的真实解析；生成、双向翻译、语音API为替身；邮件确认前0调用、模拟超时、刷新恢复相同编号、受理提示、390px不横溢、跨组织拒绝 |
| 真实DOCX/PDF解析 | 上述API专项使用合成DOCX、两页合成文字PDF，真实子进程解析 | PASS；坏PDF/空内容/ZIP超大声明拒绝，文件不持久化 |
| Token控制 | 上述API专项 | 6000字/700输出上限；翻译1–1200字/1200输出上限；双向模式、超长拒绝、不完整标记、隔离缓存、用户组织共用限额、并发拒绝、上游失败恢复 |
| 邮件授权/恢复 | 上述邮件专项 | 未确认/无权限/无真实配置拒绝；正文转义、标签、超时UNKNOWN、相同幂等key重试、过安全窗口拒绝；没有真实发信 |
| 密钥与差异 | `git check-ignore apps/api/.env`、`git diff --check` | 本地密钥配置被Git忽略；无diff空白错误 |

### DeepSeek 真实调用（仅三次合成小样本）

| 模式 | 输入/输出概况 | prompt / completion / total token |
| --- | --- | --- |
| 摘要 | 约百字合成会议，小林/小王的文档与权限测试任务；输出摘要、结论、风险 | 98 / 105 / **203** |
| 中译英 | `请于周五提交 API 文档，保持 v1.2 版本。` → `Please submit the API documentation on Friday, keeping version v1.2.` | 67 / 15 / **82** |
| 英译中 | `Please deliver API v1.2 on Friday. Keep issue #42 open.` → `请在周五交付 API v1.2。保持 issue #42 处于打开状态。` | 68 / 18 / **86** |

总计 **371 token**，没有自动重试。两次翻译通过本地真实登录→组织/项目权限→`POST /assistant/generate`→DeepSeek→审计路径验证；版本号和issue编号保留，`incomplete=false`。真实密钥未输出、未写入测试报告。

## 修复经过与边界

- PDF初始合成样本报 `bad XRef entry`，定位到PDF.js对Node Buffer切片别名的处理；改成独立 `Uint8Array` 后真实解析回归通过。
- 浏览器初轮在嵌套label上无法稳定定位select/textarea；补充显式 `aria-label`。又修复StrictMode中已取消项目请求错误提示。最终浏览器流程通过，不能把失败的初轮当通过。
- 本地默认PG端口占用、Windows共享Prisma DLL锁、临时PG共享内存遗留影响启动；改为独立目录/端口并复用已生成客户端，不终止其他项目进程。
- 复用旧Next输出目录时曾出现 `EPERM mkdir`；换全新 `.next-assistant-final-2239` 后最终生产构建通过。清理本轮生成的tsconfig临时目录项，保留其他工作。
- 本地新库缺少既有通知迁移，补齐时曾因自动审批额度耗尽未执行；恢复时间过后重试通过。此事不是安全拒绝，也不是当前阻塞。
- 邮件供应商24小时幂等保留契约已核对 [Resend官方文档](https://resend.com/docs/dashboard/emails/idempotency-keys)，实现更保守地在23小时后拒绝UNKNOWN重试。真实供应商重试/送达仍未验收。

## NOT_RUN / 发布门禁

- 真实Resend对外发送、真实收件送达/退信、邮件列表关联delivered状态：NOT_RUN；用户授权开发功能，但开发测试明确使用替身。
- 扬声器实际发声、系统语音质量、移动系统语音兼容：NOT_RUN；浏览器语音调用/停止/生命周期仅替身验证。
- 生产迁移、发布、生产域名冒烟：NOT_RUN，当前任务没有授权生产发布。
- 扫描PDF OCR、旧版DOC、超30页全文、翻译自动分块、持久/多实例AI账单预算：不在本轮实现。AI限额与缓存重启会清空，不能当硬费用封顶。
- 本轮没有重跑整个协作/Office长时间回归套件；邮件公共适配器及回调相关专项已回归。

## 复现与续做

独立本地环境启动（PowerShell）：

```powershell
$env:COLLAB_LOCAL_SKIP_GENERATE='1' # 仅现有Prisma客户端已生成且schema未变时使用
$env:COLLAB_LOCAL_NAME='assistant-verify2'
$env:COLLAB_LOCAL_DB_PORT='5560'
$env:COLLAB_LOCAL_WEB_PORT='43220'
$env:COLLAB_LOCAL_API_PORT='43221'
$env:COLLAB_LOCAL_WS_PORT='43222'
node scripts/local-up.cjs
```

新库还需在该**合成本地库**应用既有 `deploy/collabspace/apply-invitations.cjs`，避免旧通知模块缺表；本轮已应用。不要拿这些合成配置操作生产。

已保存一次续做心跳：**2026-10-25 03:18，Asia/Shanghai**，ID `automation`，当前聊天。触发时先检查本报告最终状态；已完成则保持安静，不重复模型调用、不发真实邮件、不自动发布。若有未通过的必要本地门禁，继续处理。
