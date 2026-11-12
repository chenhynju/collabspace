# 第三方服务与配置获取清单

2026-10-29追加：[20款可动角色制作、海外Meshy/Tripo入口与本地口型配置](AVATAR-20-PRODUCTION.md)。本地口型无需新增云Key，复用已有ElevenLabs音频；建模服务账户/预算尚未提供，不能把填Key等同模型/面部制作已完成。

2026-10-28会议M3、语音互转与数字人接力新增：[第三方创建、计费、凭据获取及本地存放步骤](THIRD-PARTY-SETUP-RTC-VOICE-PERSONA.md)。本专项LiveKit Cloud可先创建免费开发项目；自托管不要求购买Cloud凭据。旧文下方“只有决定自建/自管媒体房间才配置LiveKit”不限制本次新增会议范围，按新专项选择托管或自托管。

核对日期：2026-10-27。按当前代码、部署模板和数字人设计区分状态；未读取或展示真实密钥，未登录供应商账户核实余额/权限，不把已有适配器等同于已开通线上服务。

## 优先准备

1. Azure Speech：语音识别、朗读和卡通口型轨道；获取同一资源的Key、Region和云环境。
2. 真人数字人：优先申请Azure自定义Avatar访问资格，或评估LiveAvatar；国内单独确认火山对应数字人产品。不是把所有候选都开通，也不是只有一个API Key就能创建本人数字人。
3. DeepSeek、Resend：协作助手和邮件已有代码接入，若现有项目可用则复用其独立项目配置，无需重复买服务。
4. Google/GitHub登录、Stripe/PayPal按实际开放功能配置；对象存储在真人素材进入正式环境前确定。

## 业务接口清单

| 服务 | 用途与当前状态 | 去哪里获取 | 项目配置/还需准备 |
| --- | --- | --- | --- |
| Azure Speech | 已有STT/TTS适配；SDK嘴型轨道本地契约验证，真实语音未在本轮验证 | [Azure Portal](https://portal.azure.com/)选择Speech资源 → Resource Management → Keys and Endpoint；[官方入门](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-text-to-speech) | 现有AZURE_SPEECH_KEY、AZURE_SPEECH_REGION、AZURE_SPEECH_CLOUD=global/china；可选AZURE_VISEME_ENABLED=true（必须先实测）。Key和Region必须属于同一个资源；中国云独立账号/资源，不按语言自动跨云 |
| Azure自定义Avatar | 真人照片/视频的优先评估路线；真实创建/渲染适配未完成 | [Custom Avatar入口](https://speech.microsoft.com/portal/customavatar)、[官方访问资格和素材说明](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-custom-text-to-speech-avatar) | 申请照片/视频自定义Avatar访问资格，取得被允许的资源/端点/区域、已创建模型或形象标识；本人授权证据和符合该产品要求的照片/视频。当前没有已生效的AZURE_AVATAR_*配置契约，不要仅填Speech Key就当已接通 |
| HeyGen LiveAvatar | 真人实时视频替代候选，尚未完成接入 | [LiveAvatar应用](https://app.liveavatar.com/)账户开发/API设置；[API Key官方入口说明](https://docs.liveavatar.com/docs/faq/api-key) | API Key、自定义形象ID、服务模式/地区/配额、照片/视频创建权限；LITE需要我们的外部音轨和会话适配。LiveAvatar和普通HeyGen视频API不是同一套接口/额度，变量名待适配器冻结后确定 |
| 火山引擎数字人 | 国内真人路线候选，尚未接入 | [火山控制台](https://console.volcengine.com/)选择实际开通的实时互动数字人/RTC相关产品；[产品说明](https://docs.volcengine.com/docs/Largemodelofimagegeneration/realtime-interactive-digital-human-sdk-product-introduction?lang=zh) | 根据最终SDK获取该产品的应用标识、认证信息与服务权限，确认照片/视频各自能力。不要将方舟大模型API Key直接当作数字人或RTC凭据；具体字段待产品选择后核对 |
| DeepSeek | 协作摘要、翻译、行动项和受限助手；已接入代码 | [API Keys](https://platform.deepseek.com/api_keys)；[官方入门](https://api-docs.deepseek.com/) | 现有DEEPSEEK_API_KEY。网页聊天会员与API调用配置分开；模型名以代码及官方可用性核实，不能仅有Key就认定请求成功 |
| OpenAI | 未来海外版的模型、STT/TTS/Realtime可选路线；当前未接入 | [项目API Keys](https://platform.openai.com/api-keys)；[官方开发入门](https://developers.openai.com/api/docs/quickstart) | 计划用OPENAI_API_KEY（尚不是当前生效变量），独立项目、模型访问/配额；长期Key只在后端，实时前端用短期会话令牌。当前先按Azure语音路线，不需要为本轮强制开通OpenAI |
| Resend | 项目邮件、邀请及回调；已有代码 | [API Keys](https://resend.com/api-keys)、[Domains](https://resend.com/domains)、[Webhooks](https://resend.com/webhooks)；[官方Key说明](https://resend.com/docs/dashboard/api-keys/introduction) | 现有RESEND_API_KEY、EMAIL_PROVIDER=resend、EMAIL_FROM、RESEND_WEBHOOK_SECRET；发信域名需DNS验证。Webhook signing secret与API Key不同。实际代码读取EMAIL_FROM，不是旧示例MAIL_FROM |
| Google OAuth | Google账号登录，已有适配器；是否上线启用另核对 | [Google Auth Platform / Clients](https://console.cloud.google.com/auth/clients) → Web application；[官方凭据流程](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) | GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_CALLBACK_URL；配置品牌/测试用户及redirect URI。不是普通Google API Key，不需要Gmail/Drive权限 |
| GitHub OAuth | GitHub账号登录，已有适配器 | [OAuth Apps](https://github.com/settings/developers) → New OAuth App；[官方创建说明](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) | GITHUB_CLIENT_ID、GITHUB_CLIENT_SECRET、GITHUB_CALLBACK_URL；不是个人PAT，不需要仓库写权限 |
| Stripe | 订阅计费，已有代码；现有部署模板为sandbox，不代表已启用真实收款 | [Dashboard API Keys](https://dashboard.stripe.com/apikeys)、[Webhook端点](https://dashboard.stripe.com/webhooks)；[官方Key说明](https://docs.stripe.com/keys) | STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET、STRIPE_PRICE_MAP、BILLING_MODE/BILLING_CURRENCY；先用测试环境，创建产品及价格ID。Webhook secret不是API Key；当前Checkout服务端跳转不要求强行新增前端publishable key |
| PayPal | 支付/订阅可选，已有代码 | [Developer Apps & Credentials](https://developer.paypal.com/dashboard/applications/sandbox) → Create App；[官方入门](https://developer.paypal.com/api/rest/) | PAYPAL_CLIENT_ID、PAYPAL_CLIENT_SECRET、PAYPAL_WEBHOOK_ID、PAYPAL_ENV、PAYPAL_PLAN_MAP、PAYPAL_CURRENCY；Sandbox和Live分开。Webhook ID不是共享密钥，不能拿Client ID代替Secret |

## 对象存储与基础服务

| 项目 | 是否需要第三方API Key | 配置获取与状态 |
| --- | --- | --- |
| 真人素材/生成物私有对象存储 | 若选云存储，需要服务端访问凭据；当前尚未选定 | 海外可选[Cloudflare R2凭据](https://developers.cloudflare.com/r2/api/tokens/)，取得S3兼容Access Key ID/Secret Access Key、Endpoint、Bucket；国内可评估腾讯COS，使用有最小桶权限的子账号凭据和地域。具体环境变量尚未接入，不能把填凭据视为已完成迁移；当前本地真人草稿为受限数据库bytea |
| ONLYOFFICE文档引擎 | 当前自托管模式没有必须向云服务商申请的API Key | OFFICE_JWT_SECRET和OFFICE_CAPABILITY_SECRET由自己生成，API与引擎按设计配对；另配OFFICE_PUBLIC_URL/INTERNAL_URL/CALLBACK_BASE。商用授权或选择云产品是独立决策，不用“免费API Key”替代版本/许可检查 |
| PostgreSQL / Redis | 当前自托管，不需要云厂商API Key | DATABASE_URL、REDIS_URL和各自强密码；数据库应用角色应为最小权限。若以后选托管服务，使用该实例提供的连接串，不需要为本轮重复购买 |
| Vercel / 云服务器 / DNS | 部署凭据，不属于用户业务API | Vercel账户访问/自动部署令牌、服务器SSH密钥、域名DNS管理权限；已有部署方式继续使用，不因接数字人重复建站。DNS API Token仅自动改DNS时需要 |
| Three.js / three-vrm / Mermaid | 开源依赖，不需要供应商API Key | 模型资产的来源、使用权和许可与库本身分开核查；不能买API Key替代正式模型、骨骼和捏脸资产 |

历史继承技术清单中WorkOS仅是候选，当前认证为本项目NestJS/JWT/OAuth，不要求现在申请WorkOS。LiveKit可能由数字人供应商管理会话；只有决定自建/自管媒体房间才单独配置LiveKit，不能重复开资源。Tavus/D-ID等只在重新选型时纳入，不要求当前全部申请。

## OAuth / Webhook地址

| 用途 | 当前路由/地址 |
| --- | --- |
| Google回调 | https://collabspace-api.purelamp.uk/api/v1/auth/oauth/google/callback |
| GitHub回调 | https://collabspace-api.purelamp.uk/api/v1/auth/oauth/github/callback |
| Resend回调 | https://collabspace-api.purelamp.uk/api/v1/webhooks/resend |
| Stripe回调 | https://collabspace-api.purelamp.uk/api/v1/billing/stripe/webhook |
| PayPal回调 | https://collabspace-api.purelamp.uk/api/v1/billing/paypal/webhook |

以上按代码路由整理，上线启用前核对反向代理及环境，不向未确认的回调发真实测试邮件或交易。Google/GitHub详细步骤见[OAuth备忘录](OAUTH-SETUP-MEMO.md)。

## 配置应该存放哪里

- 本地：使用未跟踪私密配置文件，按当前启动方式注入apps/api；不用把密钥写到源码或public目录。本地合成验收继续保持供应商Key为空。
- 现有线上API：由既有部署流程向服务器/opt/collabspace/shared/.env.production安全注入；只改文件不会更新已运行容器，需要受控重建和验证。
- 前端Vercel只保存公开API/WS地址；不要设置NEXT_PUBLIC_AZURE_SPEECH_KEY等公开密钥变量。真正需要前端会话的产品由后端签发短期令牌。
- 后台“参数管理”当前是业务配置，不是凭据保险库；不要把原始Key写入会返回列表/审计的配置项。
- JWT_SECRET、OFFICE_CAPABILITY_SECRET、BILLING_WEBHOOK_SECRET、MAIL_ROUTE_*_SECRET是项目自己生成/约定的内部秘密，不是去供应商控制台申请的API Key。
- 新的真人/存储适配器未冻结前，不虚构已生效的环境变量。配置到位后仍要逐项做真实请求、权限、失败恢复及费用/地区验收。

你可以提供“供应商名称 + 本机私密配置文件路径 + 云环境/地域 + 已获访问权限”，不要在聊天中粘贴密钥。真实同事照片/视频和声音的授权另行记录，不能由服务器访问授权推导。
