# Office 应用集成与演示

> 后续发布更新：用户明确要求先上线；Office 已发布到正式域名并完成线上多账号验收，见 evidence/collaboration/OFFICE-ONLINE-2026-10-22.md。下文是本轮隔离开发阶段记录，其未上线描述为历史状态。


本轮按用户“现在开始、先隔离开发验证”的指示推进，不新建延后任务。私有仓库及已有生产应用保持独立；不擅自公开源码或购买授权。

## 功能入口

受控开发环境登录 CollabSpace，在项目上传 `.docx/.xlsx/.pptx`，或从“文件”的对应行点击“在线编辑”。进入真正的 ONLYOFFICE 编辑器；文件所有者在下方选择同组织成员并授权编辑或只读。共享同一页面地址后，右上角显示引擎实际报告的在线编辑者。

演示顺序：上传固定样本 → 两个账号进入同文件 → 双方输入 → 点击“保存到服务器” → 等待服务器版本增长 → 下载并打开文件 → 展开历史 → 撤权 → 从已保存版本恢复私有副本。生产域名当前仍是已发布的 Markdown 版本；本轮 Office 入口仅在隔离应用中验证。

## 内容与权限的权威

- Office 引擎拥有细粒度编辑与协同通信，CollabSpace PostgreSQL 拥有文件版本、租户/项目/文档 ACL、会话与审计。Office 二进制不能走 Yjs ticket、命名版本或 Yjs 恢复路径。
- 一个文件活动 generation 对应唯一 engine key；每个浏览器会话有独立 UUID，绑定真实账号，避免同一账号旧标签的最终保存误认为新标签。显示名称来自服务端，权限不信客户端。
- 三张附加表：`collab_office`、`collab_office_version`、`collab_office_lease`，全部 FORCE RLS，运行角色非 owner、非超级用户、无 BYPASSRLS。配置关闭后已转换文件仍受 Office ACL 保护，不回退为普通附件。
- 父项目只读授权是子文档权限上限，不能通过文档 EDITOR/OWNER 升级。相关修复也适用于已有 Yjs 资源，并有真实 PG 回归。
- 已转换文件的普通下载返回最新确认版本；匿名分享拒绝，转换前的匿名 token 返回 410；私有恢复副本使用新文件、新 ACL、新会话，只有恢复人初始可见。

## 保存与失败恢复

状态为 CLOSED → OPEN → CLOSING → CLOSED；权限、租约、保存或顺序不明确时进入 FROZEN。配置与元数据轮询续租独立浏览器会话；监视器重新检查权威权限并发出引擎 drop，最终保存事务仍重新鉴权，不能单独信 drop 命令成功。

读取 capability 绑定组织、文件、generation、真实用户和会话，五分钟有效；回调 capability 24 小时，引擎另用共享 JWT 签名。候选下载仅接受已配置引擎 origin 的 `/cache/files/`，拒绝跳转、其他源、超限文件及外部 OOXML 关系；目前不支持引擎 URL 子路径。

检查点一次只允许一条在途；userdata 绑定 generation/序号。最终保存另受活动 epoch、请求前 revision 与事务内 revision 校验。旧世代、撤权或乱序结果进入 NULL-revision 恢复候选，不覆盖确认版本；同世代不明确则冻结。二进制、head、审计一起 COMMIT 后才回调 error:0；提交失败不 ACK，重试按持久 receipt 幂等；已处理的重试不重新获取可能过期的下载 URL。

只读、撤权、候选和恢复下载均重新校验文档与父级访问。撤权不能收回已经下载的字节；Office 未声明永久离线编辑能力，不能套用 Markdown/Yjs 的离线结论。

## 可复现验证

私密 `.test-runs/office-integrated/config.json` 包含已有隔离测试身份、API/Web 地址和引擎配置，不入库。SDK 静态资源的开发缓存只为克服 SSH 吞吐瓶颈，不缓存文档、认证、回调或 WS，不代表生产性能。

```powershell
node scripts/test-collab.cjs
$env:OAUTH_TEST_REDIS_URL='redis://127.0.0.1:6399'
pnpm --filter @teamspace/api test
pnpm --filter @teamspace/web test
$env:COLLAB_BROWSER_CONFIG='.test-runs/office-integrated/config.json'
$env:OFFICE_BROWSER_TEST='1'
pnpm exec playwright test tests/browser/office.spec.cjs --output=.test-runs/browser-office-final --reporter=list
python tests/office-dev/verify-integrated.py
powershell -NoProfile -File tests/office-dev/verify-microsoft.ps1
```

并行运行不同 Playwright 进程必须使用不同 `--output`，否则会互相删除 trace 目录。本轮保留首次失败事实：回调默认 201、静态资源慢、测试选择器冲突和 PowerPoint 点击坐标错误均曾导致失败；修复后才重新验收。原始 trace 含临时签名 URL，不作为可提交证据。

三格式应用验收已一轮 3/3；既有文档、IM、Markdown、Mermaid、图文与双租户浏览器回归 6/6；真实非特权 PG/WS 32/32、API 19/19（含真实 Redis）、Web 7/7；Windows API/Web 构建通过。额外最终关闭/重开2/2、微软12.0三格式保存并以全新实例重开3/3，以及微软保存副本的内容/结构复核均通过；详见证据清单。

## 开发部署及发布边界

引擎在新机独立 `collabspace-office-dev` 容器中，仅回环 3390；应用使用隔离 PG5548/API53121/WS53122/Web53120，私有转发连接引擎。没有把引擎加到磁盘紧张的现有生产机，没有迁移客户数据。

所需私密变量：`OFFICE_PUBLIC_URL`（浏览器可达 origin）、`OFFICE_INTERNAL_URL`（后端可达引擎 origin）、`OFFICE_CALLBACK_BASE`（引擎可达 API v1 基址）、`OFFICE_JWT_SECRET`、`OFFICE_CAPABILITY_SECRET`、生产模式下必需的 `OFFICE_REGISTRY_FILE`（持久且可写），以及现有 `UPLOAD_ROOT`。不提供可直接对公网使用的开发宽松网络配置。

数据库升级先备份，再以管理连接事务执行 `schema.sql` 与 `office.sql`，显式向实际运行角色授予三张新表 SELECT/INSERT/UPDATE/DELETE；不要给予运行角色表所有权或 BYPASSRLS。首次独立初始化 bootstrap 已包含新表及授权；不能用首次 bootstrap 升级已有数据。应用回滚保留附加表与版本，不降级 Office ACL 为匿名附件权限。

公开演示/生产尚需具体的引擎 HTTPS/路由、备份与回滚、部署后业务自测，以及对应运行版本的社区版源码/许可交付准备。用户选择先开发，故这些不阻塞本轮功能验证；它们尚未完成，不能宣称 Office 已公开上线。完整高级格式兼容、Office 永久离线、容量/HA、多实例、原生 Office 评论完整流程及全面可访问性仍未验收。
