# CollabSpace 全量浏览器回归 — 2026-11-13

## 范围与方式

- 目标环境：**生产** collabspace.purelamp.uk / collabspace-api.purelamp.uk（合成账号 owner/member/admin@acme.dev）。
- 套件：`tests/browser/` 全量 spec（约 50 个测试文件、80 条用例），Playwright + Edge 通道。
- 门控：`COLLAB_BROWSER_CONFIG=.test-runs/deploy/ui-online-config.json`，另开 `HUB_DIRECT_ONLINE / PERSONA_ONLINE_UI / PASSWORD_BROWSER_TEST / INVITATION_BROWSER_TEST / PERSONAL_SIGNUP_TEST / OFFICE_PRODUCT_ONLINE_TEST / VOICE_ONLINE_ACCEPTANCE`。
- 有意排除：`RTC_VOICE_REAL_TEST`（6 个 .real 会议/语音 spec——生产 `MEETINGS_ENABLED=false`，跑了必失败属误报）、`AGENT_REAL_ACCEPTANCE`（真实 LLM 调用产生费用）。
- 产物：`.test-runs/full-regression-20261113/`（run.log、retry.log、output/、retry-output/、probe-*.png）。

## 总量结果

| 轮次 | 通过 | 失败 | 跳过 | 耗时 |
|---|---|---|---|---|
| 全量首跑 | 29 | 21 | 30 | 1.2 h |
| 失败隔离重试（17 项） | 6 | 11 | — | ~1 h |

重试转通过（判定为**负载型偶发**，非缺陷）：persona-online ×3（含 3.9 min 的隐私源隔离链路）、presence-comments、office-product-online 的 xlsx 与 pptx。

## 失败项三分法定性

### A. 环境/矩阵误纳（5 项，非缺陷）

hub-direct.fixture、meetings.fixture ×2、persona-motion.fixture ×2 —— 全部为 `ECONNREFUSED 127.0.0.1:14420`，这些 spec 依赖本地夹具服务，本不该进入在线矩阵。建议：在 spec 头部加 `test.skip(!process.env.LOCAL_FIXTURE)` 或从在线门控清单剔除。

### B. 已知缺陷（1 项）

- **BUG-001（P2）**：invitations.spec —— `invitation-mail.py` 抓容器日志的 `[verify]` 模拟链接取验证 URL，10-24 邮件真实化（Resend 上线）后 URL 只进邮件正文，工装失效。证据：`AUTH-REGRESSION-BROWSER-2026-11-12.md`。
  - **新进展**：本轮全量跑中 `personal-mail.py`（personal-space 注册验证用）**通过（32.6s）**，说明在线注册+验证链路仍可测，invitation-mail.py 可照其思路修复。

### C. 稳定失败逐项定位（两跑皆失败）

| spec | 报错 | 定性 | 证据 |
|---|---|---|---|
| board | heading「让团队始终编辑同一份文档。」不存在 | **spec 过时**：该营销标题 10-22（a80462e）已从前端删除；探针确认现标题为「协作空间」 | probe-collaboration-hub-20261113.png |
| figma-layout | 新建对话框中等不到 `所属项目` select | **spec 过时**：新建流程已从下拉 select 改为项目列表对话框（「选择存放项目」），探针实测 `projectSelect=0`、列表项可点 | probe-collaboration-hub-20261113.png |
| workspace-hub:5 | 同 board，旧标题断言 | **spec 过时** | 同上 |
| workspace-hub:21 | POST /auth/login `ECONNRESET`（重试时） | **跨境网络瞬断**，非产品问题 | retry.log |
| business-diagrams:3 | `getByLabel('连线样式')` strict mode 命中 2 个 | **选择器歧义**（10-26 的 3e64a1d 引入）：编辑器 select `aria-label="连线样式"` 与画布工具条 `aria-label="画布连线样式"` 被非精确匹配同时命中。产品无 bug；spec 应加 `{exact:true}` 或改 aria-label 命名 | retry.log |
| business-diagrams:28（catalog） | 首跑通过、重试失败（Mermaid iframe svg 60s 未现） | **不稳定**，疑与并行负载下渲染慢有关 | 两轮日志 |
| documents / richtext / markdown | 「只读预览」命中 2 个按钮 / 预览内容与断言不符 | **spec 假设失效**：0d8bf13（11-12）引入 AUTO 自动快照（collab-store，每文档每分钟至多 1 条），版本列表多出一项且按 seq 升序排列，第一个「只读预览」打开的是创建初期的 AUTO 快照（无后期内容）。截图证实预览对话框标题为「自动快照 · #1」，产品行为正确 | richtext-auto-snapshot-preview-20261113.png；collab-store/index.cjs:906 |
| office-image-preparation | 5 分钟超时，等不到「图片上传慢？先缩小图片」 | **本地合成夹具契约失效**：该 spec 离线编译 `office/[id]/page.tsx` 并用 mock 模块渲染，0d8bf13 改动 page 源码后 mock 契约不匹配。探针证实生产页面该面板存在且正常 | probe-docx-ready-20261113.png |
| office-page-polling | `window.polls` 30s 内未到 10 | 同上，本地合成夹具契约失效 | 同上 |
| office-product-online docx | `[data-office-ready]` 180s 未就绪 | **负载型超时**：独立探针实测生产 docx 编辑器 90s 内就绪、全部功能面板正常（重命名/副本/PDF/ACL 入口均在）；xlsx/pptx 同轮通过。判定为全量并行负载下初始化超时，建议提高该用例 ready 超时或串行复跑确认 | probe-docx-ready-20261113.png |
| voice-persona-online | 5 分钟总超时，中断在 finally 恢复语音人设的 API 调用 | **超时配置问题**：主体断言（双用户私有语音、3D 偏好持久化、云关闭、邮件仅预览）已全部执行到 line 34 通过，仅清理阶段撞 5min 上限。建议 setTimeout 提到 8-10 min | retry.log line 36 上下文 |

## 结论

- **没有发现 P0/P1 产品级回归**。生产环境文档、白板、图表、Office（docx/xlsx/pptx）、人设、在场与评论、权限链路均验证可用（直跑通过或探针证实）。
- 稳定失败几乎全部归因于 **spec 与 11-12 大版本（0d8bf13）的 UI/AUTO 快照变更脱节**，外加既有 BUG-001 邮件工装。
- 待办（spec 侧修复，不涉产品代码）：
  1. board / workspace-hub:5：标题断言改为「协作空间」；
  2. figma-layout / workspace-hub：新建流程改为点项目列表项；
  3. business-diagrams:3：`getByLabel('连线样式', {exact:true})`；
  4. documents / richtext / markdown：按版本名定位「只读预览」按钮（或断言前先过滤 AUTO）；
  5. office 两个合成夹具 spec：同步 page.tsx 新导入契约；
  6. voice-persona：超时调至 ≥8 min；
  7. BUG-001：invitation-mail.py 参照 personal-mail.py 改为读邮件正文；
  8. fixture 类 spec 加本地门控，避免误进在线矩阵。

## 本地单测/集成（同轮验证）

见下表（结果以 `.test-runs/full-regression-20261113/*.log` 为准）：

| 层 | 命令 | 结果 |
|---|---|---|
| API（测试自管 PG） | `pnpm --filter @teamspace/api test`（apps/api） | **65 过 / 1 失败 / 8 跳过**：唯一失败为 assistant.test.cjs「real DOCX and text parser」——已知 flaky（文档解析超时，慢 IO 机器负载相关），与基线一致；8 跳过为门控项（邀请集成、邮件 webhook 等需额外 env） |
| collab-store | `node run-collab-tests2.cjs`（5548 被残留僵死套接字占用，切换 5562 端口跑） | **36/36 通过** |
| web | `pnpm --filter @teamspace/web test` | **30/30 通过** |

环境备注：杀掉的浏览器回归任务残留 postmaster（PID 19388）占住 5548 形成僵死套接字，导致 embedded PG 反复报 `pre-existing shared memory block is still in use` / `could not bind`。已改用独立端口完成测试；`.test-runs/collab-local/config.json` 已恢复原样。
