# 生产发布 r20261112-01：认证加固（JWT fail-fast + 登录限流）

发布内容：main `1aa090c`（在 r20261030-01 之上的 delta 仅 apps/api：JWT_SECRET 缺省/过短拒绝启动、登录失败按 IP+邮箱滑动窗口限流 5 次/5 分钟）。用户明确授权部署生产。功能开关保持现状：`MEETINGS_ENABLED=false`、`MEETINGS_ACCESS_MONITOR_ENABLED=false`。

## 关键事故：构建探针拦下陈旧 dist

首次构建的镜像内探针失败：`login-throttle.js` 抛 `ReferenceError: TooManyRequestsException is not defined`。根因：本地 `apps/api/dist` 是 20:33 基于中间稿 src 的构建（当时限流用未导入的 `TooManyRequestsException`），而最终 src（21:09）改用 `HttpException`；dist 未随之更新。本机全量 `nest build` 超过 300s 被 killed，改为按 tsconfig 同标志定向 `tsc` 重编译 `1aa090c` 触及的四个源文件（auth.service / jwt-secret / login-throttle / jwt.strategy，23s 完成，EXIT=0），本地复跑探针（fail-fast 抛错 + 5 次失败后 429）全部通过后才重打包。旧镜像已在服务器上 `docker rmi` 删除，未参与激活。

**边界**：dist 是定向编译产物，与完整 `nest build` 输出的一致性未验证；建议后续在 CI 跑一次全量构建比对。

## 发布执行（按 r20261030-01 模式参数化）

- 本地 `deploy/collabspace/prepare-backend-r20261112-01.cjs`：FROM 当前生产运行镜像（api `c47eb2f4…`、ws `4b52be9c…`），打 `backend-review-r20261112-01.tgz`（607,200B，sha256 `0ade76f067e49a4b7c2c12ba6b24be69a309e38d314a3423f1336cdd1f4d22d4`，459 文件 manifest）。Windows git-bash tar 不认 `D:` 路径，tar 步骤手动以 POSIX 路径执行（prepare-review-release.cjs 同源问题）。
- 服务器 `review-build-r20261112.sh`：tgz sha256 校验 → 解包 → manifest 逐文件校验 → 双镜像构建 → 镜像内 `node --test` 六套件 **30/30 通过（# fail 0）** → 模块探针（meetings/voice 加载 + `requireJwtSecret` fail-fast + `LoginThrottle` 5 次后 429）输出 `New runtime modules load`。
- `review-activate-r20261112.sh`：备份先行——`review-migrate-backup-only.py`（本次无 schema 变更；`meetings.sql` 的 `CREATE POLICY` 无 IF NOT EXISTS 不可重跑，故改为只校验 r20261030-01 additive schema 在位）pg_dump 5,000,205B（sha256 `599172346d14ca4965c694537f9ebbfdb2f51043fe744d639d46bf87566f77dc`），uploads 卷 tar + sha256，override 切新镜像，compose up，健康等待通过。脚本修正一处：`review-native-ws.py` 硬编码旧 stage 路径，归档为 `review-native-ws-r20261112.py`（仅改 stage）。
- 新镜像：api `e686fd9505c8a90a167cea07d2f9cc3e80dd3627b46c33ca1075609abd8c66a6`，ws `0264eb32a2229f43270abada116fb3eeeb7957a1001641335e016e347332938f`。回滚：previous 镜像（c47e/4b52）仍在服务器，rollback 机制内建于 activate 脚本。

## 验证证据

- `review-verify-r20261112.sh` 全绿：容器镜像断言一致；health/ready 双端 200；数据库非特权角色、`rtc_meeting`/`rtc_message` FORCE RLS、additive 列在位、`MEETINGS_ENABLED=false` 未变、运行时 `jwtFailFast:true`；备份与 uploads 包权限 600、sha256 校验 OK；OOM=false、restarts=0。
- 线上探针：`https://collabspace-api.purelamp.uk/api/v1/health` 200；假邮箱 `release-probe-r20261112@example.invalid` 连续错误登录——前 5 次 401，第 6、7 次 **429 `LOGIN_THROTTLED`**（响应带倒计时秒数）。限流按 IP+邮箱计数，探针不影响真实用户；窗口 5 分钟后自动恢复。
- 前端：Vercel 生产部署停留在 14 天前（缺 0d8bf13 的 apps/web 改动），本次 `vercel --prod` 从 main `1aa090c` 部署 `collabspace-mbir5o20n-purelamp.vercel.app`，Ready 并成为最新 Production。`/login`、`/register` 200；`/` 返回 307 但带完整 HTML body（标题正常渲染），为既有行为非本次回归。

## 未验证边界与遗留

- 生产真实账号登录未测（无凭据，不主动探测）。
- 限流为单实例内存实现，水平扩容需换 Redis 计数（代码注释已标）。
- 服务器 `/opt` 可用 8.1G（86%），本次未做任何镜像 prune；下一次发布前建议先确认空间。
- 构建脚本里服务器需访问 npm registry 安装 livekit-server-sdk（沿用 r20261030-01 做法），本次成功。
