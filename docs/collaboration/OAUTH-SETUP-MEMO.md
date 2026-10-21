# Google / GitHub 登录配置备忘录

日期：2026-10-21。用途：给 CollabSpace 接入社交单点登录，同时保留作品集原有登录。

## 先澄清

CollabSpace 的公开 `/api/v1/auth/oauth/providers` 当前返回 Google=false、GitHub=false，说明本项目尚未配置启用，不说明作品集配置错误。作品集使用 Auth.js，本项目使用 NestJS OAuth + JWT，两者回调路由和环境变量名不同。供应商按钮出现、配置存在或授权页面打开，都不等于真实账号已登录成功。

本次只读探测作品集 `/api/auth/providers` 返回503，未能现场确认其当前供应商配置；503本身不能证明 Google/GitHub 客户端配置错误。作品集未被修改。

推荐为 CollabSpace 新建独立 OAuth 应用，便于名称、授权、凭据轮换与撤销独立管理；也可在你管理的现有应用中追加回调，前提是保留作品集原回调、正确使用该应用的匹配凭据。不要直接替换原回调。

**已核对最新 GitHub 官方说明：OAuth App 目前可配置最多10个回调地址，并非只能配置一个。** 独立应用是隔离建议，不是必须重建现有作品集的结论。

## 地址与变量对照

| 项目 | Google 回调 | GitHub 回调 |
|---|---|---|
| 作品集（标准域名 purelamp.uk） | `https://purelamp.uk/api/auth/callback/google` | `https://purelamp.uk/api/auth/callback/github` |
| CollabSpace | `https://collabspace-api.purelamp.uk/api/v1/auth/oauth/google/callback` | `https://collabspace-api.purelamp.uk/api/v1/auth/oauth/github/callback` |

作品集变量为 `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`、`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`，应保存在作品集对应 Vercel 项目的 Production 环境。不要放到 CollabSpace 前端。

CollabSpace 后端变量为 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`、`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`，安全写入服务器 `/opt/collabspace/shared/.env.production`。Compose 已配置固定的 GOOGLE_CALLBACK_URL / GITHUB_CALLBACK_URL，对应上表后端地址。不要使用前端 `/oauth/callback` 作为供应商回调；它只是后端登录完成后的兑换页面。

## GitHub 配置

1. 登录 GitHub，打开头像 → Settings → Developer settings → OAuth Apps（不是 GitHub Apps）。
2. 新建 OAuth App，或选择你确认归属的现有应用。
3. 独立新应用：Application name 填 CollabSpace；Homepage URL 填 `https://collabspace.purelamp.uk`；Authorization callback URL 填上表 CollabSpace GitHub 地址。已有应用：使用 Add callback URL 追加，不删除作品集地址，不使用通配回调。
4. 保存应用，取得 Client ID；生成 Client Secret，并立即存入私密环境文件。Client ID 和 Secret 必须来自同一应用。
5. 本项目只请求 read:user、user:email，不需要仓库写权限或 device flow。登录用 GitHub 账号须有已验证的主邮箱，私密邮箱通过授权后的 email API 读取。
6. 修改环境后重新创建 CollabSpace API 容器，单改文件不会更新已有容器环境。由部署流程执行并核对健康；不要在终端打印完整环境或 compose config 中的 Secret。

## Google 配置

1. 登录 Google Cloud Console / Google Auth Platform，选择你管理的项目。可建独立项目或在现有项目中新建 Web OAuth 客户端。
2. 配置 Branding / Audience / Data Access：准确应用名称、支持邮箱与联系邮箱。若控制台要求 App domain、隐私政策、授权域名，应填写真实页面并按提示验证 `purelamp.uk`，不要填写不存在的政策页。
3. Clients → Create client → Web application，命名 CollabSpace Web。
4. Authorized redirect URIs 添加上表 Google 后端回调，逐字符匹配，包括 https、域名、完整路径及末尾斜线。复用客户端时保留作品集原回调。
5. 本项目走后端授权码跳转，不使用浏览器 GIS 弹窗 SDK；不要将 JavaScript origins 当成 redirect URI。若为其他 SDK 配置 origin，应填站点源 `https://collabspace.purelamp.uk`，不带路径。
6. scope 仅 openid、email、profile。按控制台 Audience/发布状态要求添加测试账号、完成必要审核；不要以扩大 Gmail/Drive 权限解决登录问题。
7. 保存 Client ID/Secret 到服务器私密环境，更新 API 容器。Google Client ID 通常以 `.apps.googleusercontent.com` 结尾。

## 验收步骤

1. 检查 CollabSpace `/api/v1/auth/oauth/providers`：对应已配置供应商应为 true；这只是配置检查。
2. 用普通完整浏览器打开登录页，点击 GitHub/Google，确认授权页面的应用名称和权限正确。
3. 使用自己的账号完成授权，返回 CollabSpace，无原始 token 暴露在地址栏，能够加载本人账号与组织。
4. 首次新用户只开通自己的组织，不能获得演示组织或别人的文档权限；已有同邮箱本地账号必须是供应商已验证邮箱才可关联。
5. 退出后再次登录；取消授权应回到可恢复的登录提示。兑换码重放或换浏览器应失败。
6. 若复用了应用，另开窗口测试作品集登录，并注意作品集自身 CMS 邮箱白名单仍独立生效。不要为测试 CollabSpace 修改作品集白名单。

真实第三方登录涉及你自己的账号和供应商控制台，本轮代码/合成供应商测试通过不替代上述验收。

## 常见问题

- `redirect_uri_mismatch`：Google 配置的地址与请求 redirect_uri 不完全一致，核对客户端、协议、域名、路径和末尾斜线。
- `deleted_client` / `invalid_client`：客户端被删除，或 ID/Secret 不匹配；先核实供应商应用，再更新正确项目环境并发布。不要因此重构登录系统。
- 登录按钮不显示：本工程要求 ID、Secret、Callback 都存在；确认变量名、Compose 传递及容器重新创建。
- 返回登录失败：浏览器绑定 Cookie 过期/未保存、state 已消费、授权取消或供应商返回失败；重新从登录按钮发起，不重复访问旧回调链接。
- 作品集授权成功却进不了 CMS：还需检查其邮箱白名单/账号状态，不能直接判定 OAuth 配置错误。

## 官方依据

- [GitHub 创建 OAuth App（含多个回调地址）](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
- [GitHub 授权码和 PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Google Web Server OAuth 与回调匹配](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google OAuth 应用状态](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
