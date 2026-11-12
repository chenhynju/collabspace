# 会议M3、语音互转与数字人：第三方开通和本地配置

核对日期：2026-10-28。已核对仓库实际读取变量和官方公开资料；没有读取真实密钥、登录账户核对资格/余额，也没有替用户购买服务。服务价格、税费、付款方式、地区及账户可用性以用户结账页为准。

## 先准备什么

2026-10-29 R3：会议后端新增 `MEETINGS_ACCESS_MONITOR_ENABLED=true`，须先应用meetings.sql附加迁移，再与 `MEETINGS_ENABLED=true` 一起在测试后端显式启用。它是服务器访问复核开关，不是第三方Key；默认关闭，复核不健康时拒绝新入会。未生产发布，不能只把新Key填进前端。测试已使用现有LiveKit凭据，不需要新增付费资源。

| 优先级 | 服务/资源 | 现在做什么 | 是否立即付费 | 当前工程状态 |
| --- | --- | --- | --- | --- |
| 1 | ElevenLabs海外ASR/TTS | 复用本地已配置凭据，显式SPEECH_PROVIDER=elevenlabs | 无需为本轮新开资源；额度/费用看账户 | 已通过真实供应商及真实应用听写/朗读，R3不重复收费短样本 |
| 可选 | Azure Speech | 既有备选，不是语音功能的必需前置 | 开通前看账户资格与费用 | 适配保留，未使用真实Azure凭据验收 |
| 2 | LiveKit Cloud | 若采用托管媒体，创建独立开发项目，取得URL/Key/Secret | 先Build免费额度，不急升档 | 会议基础与聊天代码已实现；真实媒体尚未验收 |
| 3 | 真人分身供应商 | Azure先确认申请资格；LiveAvatar可作为替代，只选符合地区和照片/视频需求的一家验证 | 先确认资格与效果再买，避免同时购买多家 | 当前真人provider未实现真实创建，Key不能直接启用 |
| 4 | 卡通可动模型 | 提供/制作有授权的模型、骨骼、表情和可变形参数 | 没有必需云API费；资产制作/许可另算 | 现有20张静态稿不能替代可动/捏脸资产 |
| 后续 | 私有对象存储 | 真人素材正式使用前明确存储与地区 | 本地开发不急新购 | 现有草稿使用受限数据库；云存储尚未接入 |

M3不要求会议录制，不需为Egress录像或录制存储提前买套餐。WebRTC、WebSocket、Socket.IO、Three.js、three-vrm本身不要求第三方API Key。现有DeepSeek、Resend、OAuth和支付不因本专项重复申请。

## 1. Azure Speech：语音识别、朗读、卡通口型

### 创建和获取

1. 登录[Azure Portal](https://portal.azure.com/)。已有Azure订阅可复用计费订阅，但建议新建本项目独立资源；没有订阅则从[Azure免费账户入口](https://azure.microsoft.com/free/)按账户要求完成身份/付款方式设置。
2. 新建资源组，例如`collabspace-dev`。搜索微软的`Speech`资源，创建独立Speech资源，例如`collabspace-speech-dev`。选择订阅、资源组、实际可用Region，记住region的机器标识，不填显示名称。
3. 基础STT/TTS优先选择`Free F0`（账户/区域可提供时）；无F0或额度不足时再选择`Standard S0`。不要为拿Key额外创建无关的LLM部署。
4. 创建成功后进入资源，打开`Resource Management → Keys and Endpoint`。复制一把Key（Key1/Key2任选其一）及同一资源的Region；Endpoint也可记录供排错，本工程当前基础适配器按Region构造地址。
5. 全球Azure资源用`AZURE_SPEECH_CLOUD=global`；世纪互联中国云需要独立账号/订阅/资源，入口[Azure中国Portal](https://portal.azure.cn/)，用`china`。不按输入语言切云，中文也可以用全球资源；不能把中国Key与全球Region混配。中国云能力与资格需在对应控制台另查。

### 如何缴费/控制成本

- Azure通常按订阅计费，不是购买一个“API Key余额”。在`Cost Management + Billing`检查订阅、可用付款方式、发票和费用；不同账户协议/国家地区可能不同。
- 官方当前全球价格页列出F0标准实时STT每月5音频小时、神经TTS每月50万字符。S0按用量计费，具体地区/币种/税费看[Speech价格页](https://azure.microsoft.com/en-us/pricing/details/speech/)。这些基础额度不代表自定义真人Avatar免费。
- 在`Cost Management → Budgets`建立月预算并设50%/80%/100%通知，例如先以10美元或当地等值作为个人试验预算参考。**预算通知不会自动停用资源或硬封顶**；应用仍需限频和用量上限。见[官方预算说明](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets)。
- 不为本轮开声音克隆；普通预置音色已足够验证STT/TTS。viseme开关先保持false，接力真实验证后再按需启用。

### 填写

```dotenv
AZURE_SPEECH_KEY=填写同一资源的一把Key
AZURE_SPEECH_REGION=填写该资源的region机器标识
AZURE_SPEECH_CLOUD=global
AZURE_VISEME_ENABLED=false
```

官方SDK示例常用`SPEECH_KEY`，本工程实际使用`AZURE_SPEECH_KEY`，请以本工程变量为准。依据：[Speech认证](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/role-based-access-control)、[TTS入门](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-text-to-speech)。

## 2. LiveKit：会议音视频和屏幕共享

### 托管路线：推荐先创建免费开发项目

1. 打开[LiveKit Cloud](https://cloud.livekit.io/)，注册/登录，创建本项目开发环境，例如`collabspace-dev`；不要直接复用其他客户的媒体项目。
2. 在项目设置中取得Project URL（`wss://…livekit.cloud`），在项目API Keys区域取得/新增一组API Key与API Secret。界面入口名称若有变化，以当前项目设置为准；不要用前端短期participant token代替服务器Secret。
3. 将三项存入下述本机私密文件。项目URL本身可以给浏览器使用，但Key/Secret保留在后端；前端入会由后端鉴权后签发短期令牌。
4. 后续生产环境再建独立项目和密钥，不把开发凭据混进正式站点。

### 如何缴费

- [当前官方价格](https://livekit.com/pricing)的Build为0美元/月且无需信用卡，可先验证M1–M3。免费不等于无限使用，需核对项目实际时间/流量/并发额度。
- 如确实超出免费能力，在项目Billing中按需升级并添加控制台支持的付款方式；当前价格页Ship起价50美元/月，不能把它理解为所有用量包干。
- 媒体按连接时间及流量等计量，见[计费说明](https://docs.livekit.io/deploy/admin/billing/)。本轮不需要LiveKit AI推理、电话或录制套餐，不因页面推荐就全部开通。

会议开发代码已开始读取下列配置；本地隔离迁移后才能启用，真实媒体与撤权验收仍未完成，不更新生产：

```dotenv
MEETINGS_ENABLED=false
LIVEKIT_DEPLOYMENT=cloud
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

依据：[项目凭据组成](https://docs.livekit.io/reference/developer-tools/livekit-cli/projects/)、[Project URL](https://docs.livekit.io/intro/basics/connect/)。

### 自托管路线

不需要购买LiveKit Cloud Key；服务器端生成自己的API Key/Secret，还需媒体服务器、公网网络、TLS域名与TURN等部署条件。这会产生服务器/带宽运维成本，由R1核对现有资源再配置。不能把开发固定密钥搬到生产。Cloud和自托管二选一；真人供应商管理的LiveKit房间不自动等于本项目会议房间。

## 3. 真人数字人：先资格，后付费

### 路线A：Azure自定义Avatar

1. 先阅读[自定义Avatar说明](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-custom-text-to-speech-avatar)，从其`intake form`申请入口提交真实业务用途、订阅/资源、地区及照片版/视频版需求。
2. 当前[官方有限访问条件](https://learn.microsoft.com/en-us/legal/cognitive-services/speech-service/text-to-speech/limited-access?tabs=avatar)说明该功能需注册审批，并限符合条件、与微软客户团队合作的客户。个人开通Speech S0不代表必然有资格；无法满足资格时不要靠重复充值尝试解锁，先确认替代路线。
3. 获批后按供应商本次要求准备本人授权、照片/视频与确认素材，创建或由供应商协助生成模型，取得Avatar标识、支持API/区域、端点和额度。照片和视频两条路线分别核实，标准预置Avatar不等于本人的分身。
4. 费用依据账户实际报价和[Speech价格页](https://azure.microsoft.com/en-us/pricing/details/speech/)核对训练/托管/生成等项目；资格和效果未确认前不购买长期容量。

这条路线尚无本工程生效的`AZURE_AVATAR_*`变量，勿凭猜测添加。先把申请结果、区域/端点、模型ID及授权素材路径记在本机私密说明，后续适配器冻结后再给出正式字段。

### 路线B：LiveAvatar替代候选

1. 登录[LiveAvatar应用](https://app.liveavatar.com/)，在[Developers](https://app.liveavatar.com/developers)取得API Key。依据[官方Key入口](https://docs.liveavatar.com/docs/faq/api-key)。普通HeyGen会员/API额度不直接等于LiveAvatar额度。
2. 先用免费额度确认网络/地区和公共样例链路，再在Custom Avatars确认本人照片/视频创建权限、素材与实时同意要求、形象槽位和Avatar ID；公共样例不能证明本人分身效果。
3. 在账户套餐/计费页选择所需计划并按结账页支付。[官方额度文档](https://docs.liveavatar.com/docs/faq/credits)当前列Free 0美元/10 credits，Essential 99美元/月、1100+10 credits，Business 475美元/月、6000+10 credits；LITE为1 credit/分钟，FULL为2 credits/分钟。均以付款页最新税费/额度为准，不建议一开始购买Business。
4. 本项目已有外部STT/TTS，优先评估LITE音轨驱动是否满足需求，避免双重购买模型/语音。先关闭overage；官方说明余额不足且未开overage时不能继续会话。本人自定义形象槽位可能单独收费，Essential非企业用户可在`Settings → Custom Avatars → Manage`确认，见[官方FAQ](https://help.heygen.com/en/articles/12758866-liveavatar-faq)。
5. 实际确认照片/视频两条路线、API权限、地区、相似度及费用后才决定是否购买。当前工程还没有LiveAvatar正式适配/变量契约，不要认为放入Key即可生成。

Azure/LiveAvatar只先评估一家符合条件的路线；国内限制明确时再核对火山对应产品，不用方舟LLM Key代替数字人凭据。未经本人对具体服务与地区的授权，不上传真人素材。

## 4. 卡通模型与存储

- 卡通库不需要云API Key。需要的是有可追溯许可的可动资产（如VRM）、骨骼、表情/口型、动作和真正可变形的捏脸参数；现有20个静态形象已可复用为Agent形象，但尚无这些可动资产。不要为此误买真人服务，若需购买模型/委托制作，再提供具体规格与报价供用户选择。
- 私有对象存储当前尚未选型/接入，暂不要求新购桶或提交管理账号。正式素材使用前根据地区选R2/COS等私有桶，届时单独提供桶名、Endpoint、最小桶权限Key和预算/生命周期步骤。M3无会议录像，不因录制存储预购容量。

## 5. 本地放在哪里、如何加载

准备空白本机私密文件：

`D:\appspace\collaboration\.test-runs\private\third-party.env`

该目录已被.gitignore排除；Git忽略不等于加密，仅在自己的账号可访问的位置编辑，不上传共享盘/截图。模板在`docs/collaboration/templates/third-party.env.example`，不包含真实值；准备操作只在私密文件不存在时创建，不覆盖用户已有内容。

- Azure四项是现有代码读取变量。
- LiveKit三项及LIVEKIT_DEPLOYMENT是会议开发代码读取字段；新增MEETINGS_ENABLED默认false，仅在隔离开发环境完成迁移后显式启用，不代表真实音视频已通过。
- 真人服务Key暂记在同目录`avatar-provider-private.txt`（不要放入Git），连同供应商、地区、计划、API访问资格、模型ID和本人授权素材路径；正式变量由适配器实现后给出。不要在聊天粘贴Key/Secret或私人照片。
- 不覆盖`apps/api/.env`，那里可能含其他有效配置。Nest正常启动目前读取API工作目录的`.env`；上述私密文件**不会自动加载**。
- 现有`node scripts/local-up.cjs`会继承启动进程环境。由开发轮次核对自有端口/运行实例后，可使用Node22的`--env-file`显式注入，例如在仓库根目录：

```sh
node --env-file=.test-runs/private/third-party.env scripts/local-up.cjs
```

这会启动/初始化隔离合成测试环境，不是只检测Key的命令；现在不需要用户手动执行。启动前若进程已设置同名环境变量，Node会保留进程值，需由开发者核对实际来源。不要用shell source执行供应商提供或不可信的配置文件。

前端`.env`、`NEXT_PUBLIC_*`、public目录、后台普通“参数管理”、测试报告和截图中均不放长期秘密。线上配置需通过既有受控流程注入，用户填本地文件不会自动更新线上或授权生产发布。

## 6. 填好后告诉开发轮次什么

只需回复：`配置已保存到该路径；Azure global/实际region；LiveKit Cloud或自托管；真人服务选哪家/是否获资格；允许的试验费用上限；本人素材是否已对该供应商和地区授权。`

凭据可读不等于授权无限付费测试。实际供应商请求按用户明确的预算和素材授权执行；未给出时先做本地独立工作，并在真实付费或素材外传前明确确认范围。

接力R1必须在开发前读取本文件，核对配置存在/非空及真实服务结果，不打印值；缺资格/模型/授权素材时立即报告具体条件，不等R4才提出。真实STT/TTS、音视频互通和本人分身效果分别验收，配置成功不是总任务完成。


## 2026-10-29：Azure无法开通时使用豆包语音

本项目新增明确的供应商选择，默认仍为azure，不会自动回退或跨区外发。豆包为中国区服务；用户明确选择后才设置SPEECH_PROVIDER=volcengine。接口实现不是已开通或已验证真实效果。

1. 登录火山引擎 https://console.volcengine.com/ ，按控制台要求完成账号认证。
2. 进入豆包语音控制台，开通“录音文件极速版识别”（资源权限volc.bigasr.auc_turbo）与语音合成2.0（seed-tts-2.0）；不是火山方舟的大语言模型Key。
3. 在 https://console.volcengine.com/speech/new/setting/apikeys 创建语音API Key，确认授权包含上述两项能力。旧版APP ID/Access Token暂未接入本适配器。
4. 在对应版本的官方音色列表选已授权的中文、英文音色，将各自speaker ID写入配置。音色ID必须匹配TTS模型资源版本；不购买声音克隆或真人数字人套餐。
5. 在控制台先确认试用额度、价格和计费模式。没有免费权限时先记录报价和可接受试验预算，再做真实付费调用；不要同时购买多家服务。
6. 在现有本机私密third-party.env追加以下字段，不覆盖Azure/LiveKit已有内容。模板不是实际密钥。文件不会自动加载，由开发流程注入本地进程后测试。

```dotenv
SPEECH_PROVIDER=volcengine
VOLC_SPEECH_API_KEY=
VOLC_TTS_RESOURCE_ID=seed-tts-2.0
VOLC_TTS_VOICE_ZH=
VOLC_TTS_VOICE_EN=
```

当前支持现有中英文短录音/正文朗读工作流，仍受应用60秒录音、4000字符、每小时20次限制。识别固定HTTPS地址，音频base64直接提交，不创建公开音频链接。合成SSE接收PCM并封装16kHz单声道16位WAV；要求成功终止信号，无自动重试。豆包未提供本适配器的精确viseme，因此不冒充精确口型。网页提交前显示供应商和地区。

新增voice_job.speech_route迁移绑定供应商、区域和音色配置指纹。队列执行时配置不一致或旧任务无指纹则不提交，结果UNKNOWN，需要核查后新建请求；不隐式改用新供应商。迁移仅在隔离环境验证后按既有流程发布。

官方依据：
- https://docs.volcengine.com/docs/doubao-voice/large-model-recording-file-lite-recognition-api?lang=en
- https://docs.volcengine.com/docs/doubao-voice/http-chunked-sse-unidirectional-streaming-v3?lang=en
- https://github.com/bytedance/agentkit-samples/tree/main/skills/byted-text-to-speech


## 海外产品主路线：ElevenLabs（2026-10-29用户更新）

用户要求产品面向海外，ASR/TTS优先海外供应商；豆包仅作为明确选择的备用。现已实现ElevenLabs适配，不等于真实供应商验收。Azure可以保留，不能失败后自动切换到国内供应商。新增代码默认仍azure以保护现有环境；用户配置SPEECH_PROVIDER=elevenlabs后明确选择海外服务。

1. 登录 https://elevenlabs.io/ ，进入Developers → API Keys（或工作区设置的API Keys入口），新增collabspace-dev专用Key。给Speech to Text、Text to Speech权限；设置Key credit quota，不赋予无关的音色创建/删除权限。不要把Key ID当作完整秘密Key。
2. 在Voices试听并选账户具有API使用权限的音色，复制Voice ID。中英可以使用不同ID，或同一个确实支持中英的音色ID；默认先用平台预置声音，不开声音克隆。
3. 基础短录音采用scribe_v2；TTS默认eleven_multilingual_v2，兼容当前中英文工作流。模型ID可按实际账户权限调整，调整会改变任务路由指纹；旧排队任务不改路由外发。
4. 填写本机ignored `.test-runs/private/third-party.env`，不要覆盖LiveKit或Azure配置：

```dotenv
SPEECH_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=
ELEVENLABS_STT_MODEL=scribe_v2
ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
ELEVENLABS_VOICE_ID_ZH=
ELEVENLABS_VOICE_ID_EN=
```

5. 在Billing/Subscription核对ElevenAPI套餐、ASR和TTS各自额度、所选音色API权限及商业许可，再按结账页添加支付方式。个人免费试验与商业上线不同，不为普通ASR/TTS购买克隆或Agent套餐。付费金额/税费以账户当前页为准，未替用户开通付费服务。
6. 此文件不会自动加载；开发者注入本地测试进程后验证中文/英文录音识别、编辑确认、合成播放/停止/重播/取消。禁止将长期Key放进NEXT_PUBLIC或前端。

当前适配固定使用api.elevenlabs.io，ASR通过multipart直接提交WAV，TTS返回pcm_16000并封装WAV。海外供应商身份不等于已确认某一地区的数据驻留；EU驻留或零保留要求应另核对账户合同，当前未开启/宣称。精确viseme尚未接入，不把字符时间戳当作音素口型。

如果海外账户实在无法开通，再明确改为SPEECH_PROVIDER=volcengine并填前述VOLC_*字段；不能同时写两个SPEECH_PROVIDER，也不会自动回退。无真实凭据时测试仅是协议fixture。

官方依据：
- https://elevenlabs.io/docs/overview/administration/workspaces/api-keys
- https://elevenlabs.io/docs/api-reference/speech-to-text/convert
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- https://elevenlabs.io/pricing/api

2026-10-29 R2修正：自托管当前不签发会议token，原因是无严格撤销网关；LiveKit Cloud已实现显式撤销再结束，未生产发布。
