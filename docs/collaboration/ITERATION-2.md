# 图形编辑、实时讨论、离线配图与社交登录

2026-10-21 用户确认：继续改进 Mermaid 拖拽、GitHub/Google 登录、图文体验、评论/历史实时展现与持久离线资料。高可用、全面兼容性验收和 AI Agent 留到远期。沿用组织身份、RBAC、文档 ACL 和现有数据库，不接入第二套认证系统。

## 图形与源码

Mermaid 源码仍为唯一内容权威。流程图可拖入处理/判断/起止图元，生成唯一节点 ID 和对应 Mermaid 文本；节点拖到另一节点上追加箭头。基础思维导图可添加子主题、拖动完整子树改变父主题，拒绝循环和移动根主题。提供点击等价操作。

编辑器操作直接修改共享 Y.Text，通过原 ACK/离线/权限路径保存，再由官方渲染器更新图形。不通过坐标冒充 Mermaid 标准；图形由 Mermaid 自动布局。流程图采用追加节点/关系，保留注释、样式和 subgraph；基础思维导图以行区间移动子树。复杂语法不支持图形操作时保留源码并提示。不承诺任意 SVG 节点任意拖动坐标或全语法无损双向编辑。修改前比较当前源码，远端已变化则拒绝过期操作。

## 评论与版本

评论、回复与版本已经分别存储在 collab_thread/collab_reply/collab_version，不新增重复表。审计写入所在事务内发出 PostgreSQL NOTIFY，只有 COMMIT 后才通知独立 WS 服务。消息仅含组织/文档路由提示，不携带正文、评论、令牌或用户资料。WS 对每个接收者重新进行服务端权限校验并在授权锁保护下发送 metadata-changed；客户端收到后读取权威表。

通知是失效提示，不是数据库事实源。断线后重新读取，30秒低频对账修复漏提示；不宣称 NOTIFY 是持久消息队列或正文多实例同步。LISTEN 断线自动重连，失败不会把未提交操作广播为成功。最近100条限制本轮仍保留。

## 离线配图

正文原有 IndexedDB 草稿/pending 不变；成功鉴权下载的配图 Blob 也存入同一账号/组织/文档分区。媒体请求不可达时可回读配图；明确401/403/404拒绝不回退缓存。已知文档撤权时清理该文档所有 image:* 数据并隐藏已挂载配图；保留可导出的未同步文字草稿。退出登录沿用缓存清除流程。

“保留离线资料”调用浏览器 Storage Persistence API，明确展示是否获批。不是无限或绝对永久：浏览器可拒绝申请，用户手动清理/退出登录仍删除；首次图片上传需网络。本轮不提供完整离线应用安装/Service Worker，离线重启整个网站的路由壳不在已完成范围；测试是已有 IndexedDB 图片在组件重新挂载且媒体网络失败时回读。离线期间不能得知远端撤权，不能远程收回用户已下载的内容。

## Google / GitHub 社交登录

只读参考作品集现有 Auth.js 提供商和邮箱控制，保留本工程 NestJS JWT + 已有 UserOAuth/组织开通路径，不复制作品集 CMS 白名单或替换身份源。此处是社交单点登录，不是企业 SAML/OIDC 联邦管理。

- 使用 state、S256 PKCE、HttpOnly/SameSite=Lax 的浏览器绑定 Cookie，Redis Lua 原子校验并消费 state；错浏览器/错供应商不能消费合法流程。
- Google 要求 email_verified，GitHub 读取 primary+verified 邮箱；缺失/未验证邮箱拒绝，禁止用 provider.oauth 虚构邮箱。禁用本地账号拒绝登录。
- 应用 token 不出现在 URL。回调片段只有60秒有效的一次性兑换码，还必须持有同一浏览器 Cookie；前端清除片段后 POST 兑换并加载原用户/组织上下文。提供商 access/refresh token 不存入数据库。
- 环境变量 GOOGLE_CLIENT_ID/SECRET、GITHUB_CLIENT_ID/SECRET 必须由独立应用或合法追加回调配置提供。Google 回调 `https://collabspace-api.purelamp.uk/api/v1/auth/oauth/google/callback`；GitHub 同路径 github。推荐独立应用；现有 GitHub OAuth App 可按官方支持追加回调，但必须保留作品集地址和正确凭据，不盲目修改。操作步骤见 OAUTH-SETUP-MEMO.md。

供应商依据：[GitHub OAuth 授权](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)、[Google Web Server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)。合成供应商测试与真实账号授权分开记录。

## 验收

- I201：拖入流程图元、拖动连接、远端源码和官方图形更新；思维导图子树移动/添加；只读拒绝、循环拒绝、保留非编辑语法。
- I202：评论/版本事务提交后 WS 提示；回滚不提示；撤权用户无投递；浏览器小于30秒对账周期看到新评论。
- I203：图片下载后组件重新挂载且媒体请求失败，仍显示持久 Blob；账号/租户分区与已知撤权清理；持久存储许可结果准确显示。
- I204：真实 Redis 的 PKCE/state/浏览器绑定/重放/未验证邮箱拒绝；真实供应商配置和完整账号登录另列验收。

最新执行证据见 evidence/collaboration/ITERATION-2-2026-10-21.md，未完成或未验证项目不能标作 PASSED。
