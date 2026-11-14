# 生产发布记录：r20261114-01 邮件测试汇（BUG-001）

日期：2026-11-14 · 范围：仅后端 api 镜像 · 变更：单文件 `apps/api/src/modules/mail/mail.service.ts`（+5 行）

## 内容

`@example.invalid`（RFC 2606 保留域名）收件人永不走 Resend 真实外发，始终 `logger.warn` 落容器日志（`[verify]/[invite]/[reset]` 前缀），返回 `{provider:'console'}`。非合成邮箱路径不变。

## 构建

- 本地定向 `tsc` 重编译 `mail.service.ts`（与正式构建同标志，含 `--removeComments`），dist 影响面仅 `mail.service.js`（+ .map/.d.ts）。
- 本地探针：合成邮箱返回 `{provider:'console'}` 且 Resend stub 未被调用。
- 打包：`backend-review-r20261114-01.tgz`，sha256 `6cfa1210736f6071a81e5876bad2e75f48f86f2e9e125dca1b89e10eade6d163`，manifest 4 文件。
- 服务器 `review-build-r20261114.sh`：tgz 校验 → 安全解包 → manifest 逐文件校验 → 镜像构建（FROM r20261112-01 生产镜像 e686fd95）→ 镜像内 `node --test` 六套件 **30/30 通过** → 邮件测试汇探针 `Mail sink active; non-synthetic path intact`。

## 激活

- 备份先行：pg_dump 5,574,821B（sha256 `7245412b…47d4`），uploads 卷 tar + sha256，权限 600。
- 无 schema 变更；`review-migrate-backup-only.py` 确认 r20261030-01 additive schema 在位。
- override 仅切 api 镜像；ws（0264eb32）未动。回滚脚本内建（previous 镜像 e686fd95 留存）。
- 插曲：activate 首跑停在 native-ws 生成——`review-native-ws-20261112.py` 硬编码旧 stage 路径且已有产物拒绝覆盖；归档为 `review-native-ws-r20261114.py`（仅改 stage），清理半成品后重跑成功。与上次发布同源问题，同法处理。

## 校验（review-verify-r20261114.sh 全绿）

- 容器镜像断言一致：api `4f28dad9d2f6b9f879eeaba3c11d46bc7d41a77a304abdb8945d7fffc5104d49`，ws 未变。
- health/ready 200；运行时探针 `{"mailSink":true}`。
- 数据库非特权角色、rtc 双表 FORCE RLS、additive 列在位、`MEETINGS_ENABLED=false`、jwtFailFast 均在。
- OOM=false、restarts=0；备份文件权限与 sha256 校验通过。

## 线上验收

- `invitations.spec.cjs` 在线复跑：见 `.test-runs/invitations-after-r20261114.log`（结果以日志为准）。
- 验收工装 `.test-runs/invitation-mail.py` 经 SSH 只读拉取容器日志匹配 `[verify] <email> -> <url>`；测试汇日志格式与该正则在发版前已核对一致。

## 追加：r20261114-02（同日，邀请模拟标记补链）

- 首轮回放 invitations 发现：生产 Resend 已配置（`isLive=true`），邀请接口对未注册邮箱不回传 `inviteUrl/simulation`，合成验收链路断在「邀请链接获取」。
- 修复：`invitations.service.ts` 对 `@example.invalid` 收件人视同非 live，回传 `inviteUrl + simulation:true`（RFC 2606 保留域名，无真实邮箱外泄面）。单文件 +1 处条件。
- 打包 `backend-review-r20261114-02.tgz`（sha256 `38f60e5e…c9df`），FROM r20261114-01 镜像；服务器构建 30/30 测试通过、测试汇探针通过；备份 5,578,962B（sha256 `d34245ab…9813`）后激活；校验全绿（api `ee35c796…d8a7`，ws 未变，OOM=false）。
- **线上验收通过**：`invitations.spec.cjs` 全绿（1.1m）——双账号收件箱接受/拒绝、受邀邮箱锁定注册、显式加入、跨租户 403、侧栏字号。BUG-001 关闭。
