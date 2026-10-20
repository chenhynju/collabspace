# CollabSpace 部署与线上验收状态

2026-10-20：用户接受本机约 0.43s 的发布基线，明确批准 Vercel 前端、腾讯云弗吉尼亚独立后端，以及独立 PostgreSQL/Redis、非特权角色、随机密钥、演示账号和专用 DNS/Caddy 配置。其他项目保留。

## 已部署

- 网站：https://collabspace.purelamp.uk；API：https://collabspace-api.purelamp.uk/api/v1；协作使用同后端域名的 /collab WSS。
- Vercel purelamp/collabspace，项目 prj_ikHFp2kdcaWziNqBymd5GPVA53MS，部署 dpl_3mHHDyHg5X217663BvxjZZtGyEAa READY；apps/web，Node 22。实际前端代码与本次发布一致。
- 腾讯云独立目录 /opt/collabspace/releases/r20261020-01，compose 项目 collabspace；PG/Redis 无宿主端口，API/WS 仅绑定 127.0.0.1:3321/3322，由专用 Caddy 站点提供 HTTPS/WSS。
- 四个运行容器均 healthy；API readiness 确认 database/redis up。collabspace_app 的 rolsuper=false、rolbypassrls=false，8 张协作表启用 FORCE RLS。
- Cloudflare 仅新增 DNS only A：collabspace→76.76.21.21，collabspace-api→170.106.161.82；截图 dns-live.png。Vercel 验证 misconfigured=false，托管 TLS 签发成功；从弗吉尼亚实际请求前端 /login 返回 HTTPS 200。
- 独立随机凭据仅在服务端 0600 文件和本机忽略目录，未提交。支付 sandbox、邮件 console，不声称真实支付/邮件上线。

## 初始化与修复证据

- 初次初始化已建立结构，但 Prisma 因构建阶段缺少 OpenSSL 选错 musl 1.1 引擎，在写入演示数据前失败。修复 deps 阶段 OpenSSL 后真实重建镜像；续做显式要求 RESUME_EMPTY_SCHEMA=1，并逐表检查所有业务表为空，含任何数据即拒绝，不清库。随后初始化、种子和 RLS 完成。
- Caddy 完整配置验证通过；systemctl reload 因另一项目配置文件仅 root 可读失败。使用 root caddy reload 经现有管理端口平滑加载成功，未修改其他文件权限或重启共享服务。
- 首轮线上四项均在前端 page.goto 遇到 ERR_CONNECTION_CLOSED，未进入协作业务；保留 online-first-results.json。后端登录/建文档成功。Vercel 自定义域名证书签发后重测，不跳过 TLS 验证。

## 验收

部署前：协作/非特权 PG/WS 9/9、租户状态 2/2、API 支付/seed 保护 18/18，完整浏览器 4/4；本轮容器修复后生产 seed 保护单独 1/1。

线上首次 TLS 修复后 3/4 通过（online-second-results.json）；离线队列已恢复但固定 60 秒等待清空超时。测试改为按队列规模设置有限期限，并记录发送/ACK 数量，仍要求刷新后正文完全一致。独立复测 136/136 ACK，重放 49.3 秒，结果见 online-offline-results.json。最终完整组合结果见 online-browser-results.json。覆盖：三账号协作、离线合并、评论解决、版本只读预览/恢复私有副本、离线撤权、presence 去重/过期、原文删除后的评论、丢 ACK 稳定 ID 重连、关闭页面后的 IndexedDB 草稿重放。线上浏览器不使用数据库管理员连接。

本次没有重跑容量长测；保留原 load-baseline.json 失败基线及 load-results.json 的原始 300ms 目标未达标标记，0.43s 是用户接受的发布基线，不能改写为 300ms 目标通过。备份恢复演练、生产负载/HA、真实邮件/支付未验收。

真实登录表单 → /dashboard → Acme 组织与官网项目可见通过，见 online-login.json / online-dashboard.png。部署修复提交 8db3418 的远端 CI 全部成功，见 deployment-ci.json。

最终线上完整组合：4/4 PASSED，4.1 分钟，未跳过。离线队列 136/136 ACK，64.699 秒，刷新后正文完全一致；不能把单次 49.3 秒复测当成稳定耗时。原固定 60 秒超时保留。线上截图 online-editor.png；实际浏览器测试通过 canonical HTTPS/WSS，无跳过证书验证。
