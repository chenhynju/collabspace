# CollabSpace 独立部署

前端：Vercel 项目 `purelamp/collabspace`，Root Directory `apps/web`，Node 22，域名 `collabspace.purelamp.uk`。后端：腾讯云弗吉尼亚 `170.106.161.82`，独立目录 `/opt/collabspace`，Compose project `collabspace`，API/WS 仅绑定 `127.0.0.1:3321/3322`。Caddy 专用站点 `collabspace-api.purelamp.uk`，`/collab` 转发独立 WS，其余转发 API（含原有 Socket.IO）。

## 初始化边界

本目录的 initial-schema.sql 从本次 Prisma schema 生成，是全新独立数据库的初始迁移，不是给 TeamSpace 或其他既有数据库执行的升级脚本。bootstrap.cjs 在 public 已有表时拒绝执行；首次迁移在事务中完成，然后写入合成演示数据、建立非特权运行角色并启用 RLS。运行服务不持有数据库管理员连接；初始化容器单独接收管理连接。

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
