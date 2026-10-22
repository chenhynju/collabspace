# CollabSpace 独立部署

2026-10-22 Office 已按用户要求上线。当前后端 r20261022-02 / 641693b；前端 c40b2ae，正式域名保持不变。线上多账号证据与回滚边界见 `evidence/collaboration/OFFICE-ONLINE-2026-10-22.md`；以下早期发布步骤不能直接当本轮升级脚本重跑。

Office 引擎独立位于新机，原始3390仅回环。`office-link.service.example` 为旧机到新机的持续连接；`office-link-sshd.conf.example` 限定远端无特权账号仅本地转发到3390，禁止远程监听/终端/命令。旧机仅监听127.0.0.1及Docker私网3396，API使用 `http://host.docker.internal:3396`；浏览器使用 `https://collabspace-api.purelamp.uk/office-engine`。公网路径剥除前缀并设置官方要求的Forwarded headers，不开放引擎command端点。主机指纹必须预先核实固定，不能自动接受未知主机。

Office runtime 变量从服务器0600私密环境注入；PUBLIC_URL允许受控子路径，INTERNAL_URL使用原始引擎根origin。后端callback基址是正式API v1，registry在上传持久卷的`.office`目录。SQL升级必须以管理连接事务执行`schema.sql`和`office.sql`，向实际非特权角色显式授予三张附加表CRUD，不能授予表所有权/BYPASSRLS。

本轮旧机空间紧张，镜像在新机独立目录构建后传输，SHA256校验再加载；没有在旧机构建或清理其他项目。旧机只保留约1.2GB空间，尚未证明持续容量。下一轮优先迁移运行服务/缩减运行镜像；不同Docker存储后端的image Size口径不同，不能只按新机压缩Size估算旧机解包空间。不能盲目prune或删除仍需回滚的镜像/数据。

切回旧前端可保留新API的Office存储ACL层；已有Office文件后，不得直接回退到不知道Office ACL的旧API。需冻结并撤销活动会话、停Office入口且保留新读取授权层。数据库自动回退不能代替数据恢复审核。备份文件已验证目录但未完整演练恢复，不能宣称灾备通过。

前端：Vercel 项目 `purelamp/collabspace`，Root Directory `apps/web`，Node 22，域名 `collabspace.purelamp.uk`。后端：腾讯云弗吉尼亚 `170.106.161.82`，独立目录 `/opt/collabspace`，Compose project `collabspace`，API/WS 仅绑定 `127.0.0.1:3321/3322`。Caddy 专用站点 `collabspace-api.purelamp.uk`，`/collab` 转发独立 WS，其余转发 API（含原有 Socket.IO）。

## 初始化边界

本目录的 initial-schema.sql 从本次 Prisma schema 生成，是全新独立数据库的初始迁移，不是给 TeamSpace 或其他既有数据库执行的升级脚本。bootstrap.cjs 默认在 public 已有表时拒绝执行；仅首次建表后种子尚未写入的故障恢复可显式设置 RESUME_EMPTY_SCHEMA=1，逐表确认没有任何业务行后续做，含数据即拒绝；首次迁移在事务中完成，然后写入合成演示数据、建立非特权运行角色并启用 RLS。运行服务不持有数据库管理员连接；初始化容器单独接收管理连接。

数据库/JWT/沙盒 Webhook/演示密码在服务器私有环境文件中随机生成，文件权限 0600；不使用旧项目凭据。生产 seed 必须显式提供至少 24 字符的 SEED_PASSWORD，不在日志输出密码。初始化需要用户明确批准独立生产资源与凭据创建；批准前只构建镜像，不启动数据服务。

## DNS

- Cloudflare：`A collabspace → 76.76.21.21`，DNS only；此值来自本次 Vercel domains inspect 的推荐记录。
- Cloudflare：`A collabspace-api → 170.106.161.82`，DNS only；Caddy 自动签发证书。
- 不修改 purelamp.uk 根域及其他子域记录。

## 发布步骤

发布目录例：`/opt/collabspace/releases/r20261020-01`。以下命令须在明确批准初始化、私有环境已生成后执行：

```bash
cd /opt/collabspace/releases/r20261020-01
docker compose -f deploy/collabspace/compose.yml --env-file /opt/collabspace/shared/.env.production up -d postgres redis
docker compose -f deploy/collabspace/compose.yml --env-file /opt/collabspace/shared/.env.production --profile tools run --rm init
docker compose -f deploy/collabspace/compose.yml --env-file /opt/collabspace/shared/.env.production up -d api collab
```

首次上线前核对非特权角色、FORCE RLS、API readiness、WS readiness；验证 Caddy 配置后仅添加该站点并 reload，保留原站点。数据库和 uploads 各有独立持久卷；应用回退切换本项目旧镜像，保留数据卷。不得使用继承的 `deploy/hetzner/deploy.sh`（其中存在旧目录和 reset 操作）。

Vercel 的 NEXT_PUBLIC_API_URL 为 `https://collabspace-api.purelamp.uk/api/v1`，NEXT_PUBLIC_WS_URL 为 `https://collabspace-api.purelamp.uk`（既有 Socket.IO）；文档 wss 地址由 ticket 接口返回。页面只认可 canonical 域的 CORS，不临时放开 Origin 白名单。

## 线上业务自测

在私有 `.test-runs/deploy/online-config.json` 放置 WEB_URL、NEXT_PUBLIC_API_URL、TEST_ORG、TEST_PROJECT、TEST_MEMBER、TEST_ADMIN 和 TEST_*_EMAIL、TEST_PASSWORD。只使用新部署的合成演示组织；配置不提交。线上浏览器测试不接收 DATABASE_ADMIN_URL。

```powershell
$env:COLLAB_BROWSER_CONFIG='.test-runs/deploy/online-config.json'
$env:PLAYWRIGHT_JSON_OUTPUT_NAME='evidence/collaboration/online-browser-results.json'
node node_modules/@playwright/test/cli.js test --output=.test-runs/browser-online --reporter=list,json
```

覆盖三账号编辑、短时离线合并、评论/孤立评论、只读版本预览、恢复新私有副本、撤权拒绝、多标签 presence、丢 ACK 重连及草稿关闭重开。线上丢 ACK 用相同 updateId/seq 的重放确认和刷新内容验证；数据库行数去重断言仅保留在本地/CI 的非特权 PG 测试路径，不给浏览器验收传递管理员密码。

HTTP 200、前端 READY 和镜像构建成功都不是上述业务流程通过。完整线上报告必须在 DNS/TLS/后端初始化完成后据实写入。
