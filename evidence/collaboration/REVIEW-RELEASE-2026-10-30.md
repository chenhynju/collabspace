# 当前代码审查、自测与发布（2026-10-30）

用户授权当前项目审查、修复、自测、适当归档与部署。使用合成演示账号，无真实邮件/资金操作。日期按 Asia/Shanghai。

## 发布身份与归档

- 前端：`dpl_GYkrwDrLazXLs7dDEvnkcNUJQHvy`，`https://collabspace-aklic8n8m-purelamp.vercel.app` 已 promote 到 `https://collabspace.purelamp.uk`；Vercel 构建 READY，2m42s。
- API：`collabspace-api:review-r20261030-01`，`sha256:c47eb2f45feefcee24fedcd13fadf1a3a19f5740a39031cf00d0e7d22522a74d`。
- WS：`collabspace-ws:review-r20261030-01`，`sha256:4b52be9ced045d05bc1746f782308a0af2c049ef1f86431c1a02ed442355445b`。
- 基础 HEAD：`1893a4be7651cdd07d440b753c02f6b6ff0976f7`。发布包含未提交工作树，不能用 HEAD 代替完整发布源码。
- 996 文件及逐文件 SHA256：`.test-runs/deploy/review-r20261030-01/SOURCE_MANIFEST.json`。源码归档 73596985 字节，SHA256 `655287ebf90f6a7c64193e9cd31c6a66dbf205117ada5c649d93965caf3427a0`。
- 后端候选包 598139 字节，SHA256 `61aa48e617e00cd5a48401fbc67889aea63a086bba9c1c147c8a06f3e3498b3a`，服务器验证清单后构建。
- 58 个旧 `.next-*` 目录移到 `.test-runs/archives/web-builds-20261030`；保留 `.next`、活动 `.next-collab-local` 及原有脏改动。

## 已修复及发布事件

1. 项目切换/断线可能显示旧成员，Socket 连接未经房间授权就显示成功。改为组织/项目作用域状态，成功 ACK 才标记连接并刷新，清理后忽略旧 ACK。新增切换、拒绝、断线及迟到回包测试。
2. 首次切换发现历史 Compose 的 WS 指向退役的 `postgres:5432`；API 已使用原生 `172.25.0.1:5543/collabspace`。新 WS 启动安全检查拒绝，60 秒就绪门禁触发镜像回退；回退镜像仍受错误配置影响。读取 API 已验证目标生成服务器 0600 私有 `native-ws.json`，对齐 WS 后重新切换，两服务就绪。配置修复已纳入发布/回退脚本。期间 WS 短暂不可用，不将首次尝试记为成功。
3. 形象回归支持独立截图目录，保留历史截图；本轮截图在 `.test-runs/review-20261030-persona`。

## 最终测试

| 层次 | 结果 | 边界 |
| --- | --- | --- |
| API test | PASSED 63，SKIPPED 8，FAILED 0 | 跳过需专项 PG/Redis/口型二进制的测试，不算通过 |
| API lint/build | PASSED | `tsc --noEmit`、`nest build` 退出 0 |
| Web test | PASSED 30/30 | 含新增作用域/ACK 测试 |
| 协作存储 | PASSED 36/36 | 本地真实非特权 PG，CRDT、ACL、RLS、恢复、Office 存储、快照 |
| Linux 候选镜像 | PASSED 30/30 | 无网络、384MiB、0.5CPU；解析/支付/素材/语音契约；会议/语音新模块加载通过 |
| 本地浏览器最终分组复测 | PASSED 5/5 | 会议 fixture 2、真实时间轴 1、presence/评论 1、租户 1 |
| 正式主回归 | PASSED 8，SKIPPED 1，FAILED 0 | 文档直开/重命名、三类 Office 创建路由、解析、私有素材/支付禁用、presence/评论、HTTP/WS 跨租户拒绝 |
| 正式形象 UI 补测 | PASSED 1/1 | 显式开启原跳过项；20 款筛选、保存/刷新、Agent 展示，最后恢复原配置 |
| 正式快照专项 | PASSED 1/1 | 真实 WS 编辑 AUTO、不可变历史、命名版本、时间轴、Viewer 恢复拒绝、私有副本/刷新一致；专项产物已归档 |

正式环境合计 10 项独立用例通过。Office 仅创建与路由，不等于引擎往返。首次本地测试曾因 PG/Redis 未启动、fixture 端口不匹配、冷启动/连接票据过期失败；修正环境及缓存归档后最终复测通过，失败日志保留。

清理只归档本次 7 份入口/权限测试文档，以及快照专项自己的 2 份文档；验证列表状态为 ARCHIVED，未删除文档/文件数据。形象配置补测后恢复原选择。

命令来自实际 scripts：

```powershell
pnpm --filter @teamspace/api test
pnpm --filter @teamspace/api lint
pnpm --filter @teamspace/api build
pnpm --filter @teamspace/web test
node scripts/test-collab.cjs
$env:COLLAB_BROWSER_CONFIG='.test-runs/deploy/ui-online-config.json'
$env:HUB_DIRECT_ONLINE='1'
node node_modules/@playwright/test/cli.js test tests/browser/tenant-isolation.spec.cjs tests/browser/presence-comments.spec.cjs tests/browser/hub-direct-online.spec.cjs tests/browser/persona-online.spec.cjs --output=.test-runs/review-20261030-online --reporter=list
node node_modules/@playwright/test/cli.js test tests/browser/review-release.spec.cjs --output=.test-runs/review-20261030-online-timeline --reporter=list
$env:PERSONA_ONLINE_UI='1'
$env:PERSONA_SCREENSHOT_DIR='.test-runs/review-20261030-persona'
node node_modules/@playwright/test/cli.js test tests/browser/persona-online.spec.cjs --grep 'online UI' --output=.test-runs/review-20261030-persona-browser --reporter=list
```

原始日志：忽略目录 `.test-runs/review-20261030-*.log`，包括 `browser-retry`、`meetings`、`online`、`online-timeline`、`persona`、`linux-build`、`activate`、`native-ws-fix`。

## 数据、运行配置与回退

服务器目录 `/opt/collabspace/shared/review-r20261030-01`。沿用非特权角色、原生 PG 与 Redis；新增 `collab_version.source`、时间轴索引、`voice_job.speech_route` 及会议表/函数/RLS，为单事务兼容添加。

数据库 custom dump 4913909 字节，SHA256 `b1e61627302b51fb0ad0ff219621726cbb14be05bfa3790e3ea08b21f9304c94`；pg_restore 目录已验证含业务数据。`before-uploads.tgz` 717614 字节，哈希留在服务器；备份权限 600。未做完整恢复演练。

实际 Compose 链：`base-compose.yml`、`previous-override.yml`、`override.yml`、`native-ws.json`，配合 `env-before`，project `collabspace`。私有配置不入仓库。

必要时的应用回退：

```sh
cd /opt/collabspace/shared/review-r20261030-01
docker compose --project-name collabspace --env-file env-before \
  -f base-compose.yml -f previous-override.yml -f rollback.yml -f native-ws.json \
  up -d --no-build --no-deps api collab
```

保留旧镜像与兼容数据结构，不自动回退数据库。Compose 重建时移除了同 service 标签下已停用的 `collabspace-collab-1-pre-native` 容器；旧镜像、数据库/上传卷未删除。

即时资源：API 81.3MiB/384MiB，WS 15.39MiB/256MiB，均 OOM=false、重启 0；磁盘余 8.4GB（86% 使用），可用内存约 1998MiB。这不是长稳/容量成绩。

最终 `review-verify.sh` 退出 0：API/WS 镜像与候选 IMAGE_ID 一致，运行角色无 superuser/BYPASSRLS，协作文档运行时 RLS 门禁通过，两会议表 FORCE RLS、新字段及禁用会议配置验证通过，备份/私有覆盖文件权限 600，上传备份哈希复核成功。

## NOT_RUN

正式会议禁用；未验证 LiveKit 媒体稳定性、真实 STT/TTS、原创 20 款可动模型、真人生成、真实邮件/付款、完整 Office 引擎往返、DESIGN 全部 AT、全浏览器矩阵、持续负载和灾备恢复。最新范围见[当前状态](../../docs/collaboration/CURRENT-STATUS-2026-10-30.md)。
