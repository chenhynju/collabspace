# 原生 Markdown 发布与线上验收

功能源码：79971e61da22a0a9887857013b58ebfe617873c0，已推送私有 chenhynju/collabspace。

生产后端 r20261022-01，API/WS/PG/Redis 均 healthy；前端 dpl_FfpHYzJzxLfonsn29oR27pNRG3N3，正式域名 https://collabspace.purelamp.uk 。先部署兼容 API/WS 与类型约束迁移，再 promote 前端。Office 不包含在生产入口内。

## PASSED

- 本地 PG/WS 28/28、Web 单元 7/7、API 和 Windows Web 构建、完整 Markdown 浏览器 1/1、既有业务浏览器 5/5。
- [功能提交 CI](https://github.com/chenhynju/collabspace/actions/runs/39667631879)：Terraform、Dockerfile、Lint/Build/Test、Tenant and product acceptance 全部通过。
- 正式域名线上浏览器 **6/6**：文档协作、IM 单条消息不重复、原生 Markdown、Mermaid、图文、跨租户 HTTP/WS 拒绝。
- Markdown 线上实际测试：UTF-8 BOM/CRLF 导入、项目与全局文件入口、双编辑者/只读用户、GFM/Mermaid 安全预览、双人收敛、离线源码编辑与内容相同的 .md 下载、重连同步、实时评论、版本预览、私有恢复及刷新持久化、副本对非成员不可见。
- 部署前数据库备份 before-r20261022-01.dump 可用 pg_restore --list 读取，目录 432 行；旧 r20261021-06 镜像与目录保留回滚。兼容迁移不删除旧文档，新前端 schema=3，旧富文档 schema=2 仍接受。

命令：`COLLAB_BROWSER_CONFIG=.test-runs/deploy/online-config.json pnpm exec playwright test tests/browser/{markdown,documents,im,mermaid,richtext,tenant-isolation}.spec.cjs`（PowerShell 用 `$env:COLLAB_BROWSER_CONFIG=...` 并逐项传文件）。脱敏完整结果 markdown-online-browser.json；截图 markdown-online-workspace.png。

## NOT_RUN / 边界

本轮未重新压测，不改变早期失败压测证据，不声称 300ms 或多实例通过。备份只验证目录可读，未完整恢复演练。Office 仅完成三格式双人编辑、保存与 Microsoft Office 样本检查，详见 OFFICE-ISOLATED-2026-10-22.md；现有文件模块的生产 Office 身份/权限/撤权及故障恢复集成尚未完成。

上线后旧服务器可用约 2.4GB，未清理其他项目。后续重量级 Office 服务仍使用新机独立评估。此次本地 API/WS/Web 与隔离 PG 已停止；私有 Office 开发环境保留。一次性 03:00 自动任务已删除，不会每天重复执行。
