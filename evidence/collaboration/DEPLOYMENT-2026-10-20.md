# CollabSpace 部署与线上验收状态

用户 2026-10-20 接受本机约 0.43s 延迟，要求先自测、commit/push、部署并在线上自测。用户指定 Vercel 前端、腾讯云弗吉尼亚服务器后端，主域名 collabspace.purelamp.uk。

## 已完成

- 现场核对仓库原 HEAD 240a68d、工作树干净；该提交远端 CI 全部成功。
- 本轮协作/非特权 PG/WS 回归 9/9、租户状态 2/2、API 支付与生产 seed 保护 18/18 通过。
- 部署前原浏览器四项再次通过；改造为支持私有线上配置后发现多标签场景在文本尚未确认保存时立即选区的测试竞态，补足 durable ACK 和可见选区前置条件，独立重测通过；最终组合结果见 predeploy-browser-results.json。首次失败保留 predeploy-first-results.json，不算线上缺陷已修复的证据。
- 创建独立 Vercel 项目 purelamp/collabspace，Next.js、apps/web、Node 22。部署 dpl_3mHHDyHg5X217663BvxjZZtGyEAa 为 READY，生产别名已分配 collabspace.purelamp.uk；原始状态见 vercel-deployment.json。DNS 尚未配置，不能据 READY 宣称网站业务可用。
- 腾讯云 170.106.161.82 SSH 已只读核对，现有 Docker/Caddy 服务保留。新目录 /opt/collabspace/releases/r20261020-01；本项目镜像 collabspace-init/API/WS 已真实构建成功（约 1.68GB/751MB/892MB）。还没有启动 CollabSpace 数据容器或应用容器。
- 生产编排独立卷、数据库和运行角色、127.0.0.1:3321/3322 端口、内存限制；准备了全新数据库初始迁移和拒绝覆盖非空数据库的 bootstrap。API 镜像用户固定 uid 10001，上传卷由初始化配置所有权。
- seed 支持私有 SEED_PASSWORD，生产缺失/过短密码会在数据库访问前拒绝，不输出密码。线上 Playwright 只读取私有配置并要求 HTTPS，不接受数据库管理连接；丢 ACK 通过稳定 updateId/seq 重放和刷新内容核验。

## 待批准：生产初始化

自动审批拒绝了在共享服务器持久创建数据库/JWT/Webhook/演示账号凭据的命令，理由是此前授权未明确覆盖生产凭据和资源初始化。命令没有执行；已通过 SSH 确认 /opt/collabspace/shared/.env.production 不存在，没有 CollabSpace 运行容器。

已向用户请求明确批准：仅为 CollabSpace 新建独立 PostgreSQL/Redis 持久卷、非特权角色、随机密码与密钥、合成演示账号，新增专用 Caddy/DNS 配置并上线，其他项目不变。批准到达前不重试被拒绝动作，不使用旧工程凭据，不把构建镜像当成运行成功。

Cloudflare 已登录且 DNS 列表已现场核对，无 collabspace/collabspace-api 现有记录。待批准后新增 DNS only 的 A 记录：collabspace→76.76.21.21（Vercel 本次推荐），collabspace-api→170.106.161.82；不修改其他记录。之后安装专用 Caddy 站点、验证配置并 reload，再验证真实 HTTPS/WSS。

## 线上自测：NOT_RUN

后端初始化、DNS/TLS、完整三账号浏览器业务测试尚未执行。线上必须验证创建/共享、多人编辑、离线重连、评论解决/孤立评论、版本预览/恢复私有副本、撤权拒绝、ACK 丢失重连以及草稿关闭重开。只有这些测试真实通过后才可把本状态改为线上通过。

部署和线上测试命令见 deploy/collabspace/README.md。发布账号/密钥仅存私有环境或忽略目录，不能写入此报告或提交 Git。
