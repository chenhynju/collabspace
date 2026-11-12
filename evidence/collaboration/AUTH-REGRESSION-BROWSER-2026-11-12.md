# 认证加固后真实用户行为回归（在线生产）2026-11-12

背景：r20261112-01 发布（JWT fail-fast + 登录限流）只改了登录/认证路径，按 QA 门禁「核心路径变更后需行为回归」，对生产环境执行登录相关的浏览器行为测试子集。执行方式与 r20261030-01 发布一致：Playwright（Edge 通道）+ `COLLAB_BROWSER_CONFIG=.test-runs/deploy/ui-online-config.json`，合成账号，HTTPS。

## 执行结果（2 通过 / 1 阻塞）

| 用例 | 结果 | 耗时 | 覆盖的真实用户行为 |
|---|---|---|---|
| tenant-isolation.spec.cjs | PASS | 26.1s | 两租户互拒对方文档 HTTP 访问、伪造 WebSocket 身份被拒（新构建的 JWT 验签路径） |
| account-security.spec.cjs | PASS | 38.0s | UI 修改密码全流程：错误当前密码告警、两次新密码不一致告警、伪造 userId 400、改密后旧 token 401/旧密码 401、新密码登录成功、恢复演示密码。错误密码尝试 2 次，未触发新限流（阈值 5），限流不影响正常用户行为 |
| invitations.spec.cjs | **BLOCKED（工装失效）** | — | 见 BUG-001 |

补充探针：生产 `POST /auth/login` 用合成账号密码返回 201，确认加固后正常登录不受影响。

## BUG-001（P3，测试基础设施，非产品缺陷）

- **现象**：invitations.spec 在线执行失败，`invitation-mail.py` 报 `Synthetic verification message not found`。
- **根因**：该工装依赖「邮件模拟模式把 `[verify] <email> -> <url>` 打进容器日志」。自 2026-10-24 邮件真实化（`RESEND_API_KEY` 配置）后，`mail.service.send()` 走 Resend 分支，URL 只进邮件正文，日志只有 `邮件已发送 via Resend id=...`。工装假设失效。
- **产品侧证据链（未断）**：注册 201 → 生产日志确认两封验证邮件经 Resend 发出（`to=invite-ui-sender-1794497241696/…625078@example.invalid`，各有回执 id）。断裂的只是「自动取回验证链接」这一测试动作。
- **排除认证加固归因**：加固 delta 仅 JWT_SECRET fail-fast 与登录限流，不触碰注册/邮件；失败点在注册后的取链接步骤。
- **次要发现**：环境上 `python` 需指向带 paramiko 的 Python312（Kimi 内置 venv 无此模块），已在本次执行中解决。
- **修复建议**（未实施）：`send()` 对 `example.invalid` 等合成域增加 console 分支（既恢复在线行为测试能力，又避免向不可投递地址消耗 Resend 额度）；或提供仅测试用的验证令牌只读通道。需用户决策后另开任务。

## 边界与残留

- invitations 两次中断运行在生产各留下一对合成账号（`invite-ui-*@example.invalid`，不可登录、不可收信），与历次在线验收一致；如需清理走既定受控清理流程。
- 本轮仅覆盖登录/安全相关 3 个 spec，非 50 spec 全量回归；全量回归建议另排窗口。
- 登录限流的生产实证（429 探针）见 RELEASE-AUTH-HARDENING-2026-11-12.md，本轮行为测试从侧面确认正常密码路径不受限流影响。
