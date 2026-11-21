# 数字人继续开发交接（2026-10-27）

用户要求继续实现DIGITAL-HUMAN-DESIGN.md两条路线，不能以卡通替代真人、以照片替代视频。用户已认可小岚方向；追加Agent后台选择固定预设或捏脸、目标男10女10、真人极高相似度（以张雪峰数字人效果为视觉期望，不复制该人物）。当前仅第一阶段本地实现，**未完成完整功能、未上线**。

先读取AGENTS、详细设计和evidence/collaboration/DIGITAL-HUMAN-2026-10-27.md，核对git status及最近提交。开发归档分支codex/digital-human-20261027，标签collabspace-20261027-digital-human-foundation；不强制重置，保留用户新改动。设计文件是本任务先前用户授权写入的脏改动，随本阶段归档。主分支/线上仍为Mermaid已验收版本，不直接部署本阶段。

## 已有代码与证据

- 原创agent-lan-v1.png静态外观稿和完整prompt（public/personas/README.md）；明确非可动3D。Agent按需240px舞台，去球体/正弦假讲话；VRM加载器支持时序口型，但当前无正式VRM资产及实机模型验收。
- 后台system/configs中的AgentAppearanceSettings和voice/persona/agent：组织配置、config:edit、乐观锁、审计/RLS，目前唯一真实可选为小岚静态稿。20款/捏脸尚未完成，不用一图多名充数。
- PersonaPanel为真人私有草稿入口，PHOTO/VIDEO、本地预览、本人本次私有保存授权、API存储/加载/撤销；不是供应商训练、生成或真人消息发送。
- PersonaService/Controller/domain + packages/collab-store/persona.sql：私有bytea草稿20MB/件、3个有效草稿/人、7天访问期、actor+org RLS；过期访问拒绝/访问触发清理不是定时物理删除。视频只有容器检查，未完成解码、人脸、病毒检查；上线前必须补齐。
- azure-viseme.ts和SpeechProvider：SDK1.53.0，同一次TTS返回音轨与offset；voice_job新增result_visemes；默认flag未开启、无真凭据，SDK仅fixture验证。作用域character-playback隔离组织/用户/项目/Agent，旧会话释放不影响新会话。
- PASSED：Web25/25；API构建和数字人/语音6/6；API全量串行47过6跳过；SQL直接应用角色RLS与撤销删字节；新功能本地3/3、语音回归3/3；Next生产构建38页（.test-runs/digital-human-production-build-final.log）。API默认并行DOCX曾超10秒，单项/串行复核通过但负载风险保留；未改超时。
- 第一次UI测试误选IM附件框，第二次精确label完整3/3通过；旧提示词回归断言已更新。fixture不算真实STT/TTS。

## 继续工作顺序

1. 先检查是否另一接力正在修改，避免并发同文件。若已完成并有真实验收/归档证据，核对后删除自己，不重复工作。
2. 资产与角色库：从已认可小岚风格扩展男10女10，分清静态外观稿、正式VRM、骨骼/表情和动作资产。可用内置imagegen制作原创角色稿，每个资产必须保存在项目、记录prompt与来源；图片不是3D模型。正式模型需可追溯来源和许可，不能下载不明许可真人/游戏资源。只将真实交付的资源变为可选预设。
3. 后台按Agent/组织配置预设及版本；捏脸需正式模型可变形参数、可见预览/保存/刷新，缺模型时保留明确阻塞，不做不生效的滑块。现有后台仅协作助手单Agent，未来扩展不能新增平行身份。
4. 真人：当前UnconfiguredAvatarProvider仍未实现真实适配；继续实现可核查的照片/视频创建、审核/发布、音频驱动或原生文本驱动适配、受控生成物与本人确认发送。先核对官方当前API，再写合同测试；不要凭空造API。无访问资格/凭据/本人授权样本时不得发送外部素材或标真实通过，不开通付费资源、不自动做声音克隆。
5. Azureviseme真实中英/地区、口型同步和VRM模型实机，随后照片/视频高相似度/两地区/恢复/取消/费用/撤权/邮件与IM回归。生产上线前补完整媒体检查、私有对象存储、物理清理、配额与恢复；新迁移只验证隔离库，未经具体授权不生产迁移。
6. 按PASSED/BLOCKED/NOT_RUN更新报告和本交接，提交/分支/标签/压缩包SHA256归档。任务仅一次，完成后删除自身；只在完成、实质阻塞或需要用户输入时通知。若另一接力仍有必要则更新提示，不重复部署。

## 本地环境与收尾

测试环境仅本机：.test-runs/voice-persona-final/config.json（私有，不提交），PG15449、Web14320、API14321、WS14322、Redis6399；Azure/DeepSeek空、邮件console。服务本轮结束时关闭，数据库和证据保留。续启沿用scripts/local-up.cjs，COLLAB_LOCAL_NAME=voice-persona-final、SKIP_GENERATE=1、SKIP_SCHEMA_PUSH=1，并确认端口/进程归属。Redis配置为127.0.0.1且无持久化，现存C:/Program Files/Redis/redis-server.exe。API经ts-node运行；源码改动需仅重启自有API（local-up本身不watch）。私有配置JSON必须通过tests/browser/config.cjs补默认合成账号。

Node22.20.0绝对路径；当前pnpm经现存fallback为11.25.0，新SDK包和lock已同步。不要更改全局nvm，不要误用v22/node_modules/pnpm/bin/pnpm.cjs（该位置现为原生pnpm12）。构建须在apps/web工作目录运行next build，根目录直接传apps/web会丢失Tailwind相对配置。Next自动写入tsconfig的生成types路径收尾移除。

旧测试库缺invitation_delivery/invitation_sync_inbox，会有既有后台错误，不冒充本轮通过。不得误删别的工作树/文件或用户进程。线上无改动，不需要本轮服务器迁移。

接力已创建：北京时间2026-10-28 00:42 / 05:44，各一次；id collabspace-00-42、collabspace-05-44。触发时5小时剩余9%。收尾已按归属停止本地PG/API/Next/WS/Redis，保留数据库、清除自动生成tsconfig include项。

## 2026-10-27 第二阶段增量（优先阅读，覆盖上方旧状态）

当前工作树尚未提交：新增男10女10共20张独立原创静态角色稿、prompt/provenance、SHA256清单及scripts/build-persona-catalog.cjs；生成器write/check均已通过20个唯一文件，仍为0个可动模型。共享packages/collab-protocol/personas注册表已接到API和前端选择/展示；后端不再仅允许lan-v1，仍只有协作助手单Agent配置。Web单元26/26通过，API/Web类型检查日志无错误；尚未完成本阶段最终浏览器和生产构建验收，不能写作整体通过或上线。

新增过期草稿每小时可选清理PERSONA_PURGE_ENABLED（默认false），隔离库中应用角色实测分批删除20再1条跨组织过期合成草稿，保留2条未过期源数据，写入21条原子脱敏系统审计，并拒绝调用者传入目标条件。此为隔离库直接函数验证，不是生产迁移、定时器整小时验证或云存储删除证明。

第三方服务清单：docs/collaboration/THIRD-PARTY-SERVICES.md，包含实际变量、官方申请入口、回调和私密配置位置。Azure Speech与自定义Avatar资格分开；未来OpenAI、LiveAvatar/火山候选和对象存储尚未接通。已修正示例MAIL_FROM为实际EMAIL_FROM，补viseme/清理flag部署注入。

接力先检查工作树与正在运行的自有本地环境。可能仍有local-up及PG15449/Web14320/API14321/WS14322/Redis6399；不能沿用上方“已关闭”结论。API是非watch，最终20张注册表生成在API启动之后，须仅重启自有API以加载最新目录。先核验20条目录、后台男女筛选/预览/保存/刷新、组织隔离/权限/冲突及Agent面板实际选中形象，再跑必要API回归和生产构建。新增截图与证据另命名phase2，不覆盖已有验收。更新public/personas/README.md旧的单图说明。核对本阶段类型检查退出码，不能仅凭空日志宣告通过。

本阶段未归档、未部署；后续应补evidence/collaboration/DIGITAL-HUMAN-PHASE2-2026-10-27.md，更新设计/入口，按归属关闭环境并移除Next临时tsconfig路径，再提交现有codex/digital-human-20261027分支和新阶段标签/压缩包SHA256。不要重复生成已完成的20张静态稿；继续真正缺少的VRM/骨骼/动作、有效捏脸及真人供应商适配。没有凭据/授权素材时真实STT/TTS和真人效果仍BLOCKED。

## 2026-10-27 用户追加：固定域名官方沙盒支付重验

两次接力必须纳入支付重验，不因数字人阶段已完成而跳过本项。读取docs/STAGE-CLOSURE-2026-10-19.md、evidence/foundation-2026-10-19/DELIVERY.md和docs/PAYMENTS-SANDBOX.md，先核对当前部署、官方测试凭据与事件端点的环境，凭据不输出、不入仓库。仅使用Stripe Test/Sandbox与PayPal Sandbox、合成买家/官方测试支付方式；不切Live、不产生真实资金交易、不申请商户、不改真实客户订阅。

必须保留并逐项关闭的历史边界：
1. Stripe固定域名已验证Checkout创建及测试发票付款回调，但发布后未重新完整通过浏览器托管Checkout付款。
2. PayPal官方Sandbox续费失败及恢复周期尚未运行。
3. 历史验收不能保证当前部署正常，本轮尚未重跑。
4. 官方沙盒无真实资金流转，不能证明正式商户资格、真实收款或银行结算。

优先：当前实际域名、独立测试组织，从站点进入Stripe托管Checkout、官方测试卡/认证、回跳、签名Webhook自动授予准确权益、刷新持久化、取消后回收。PayPal从实际域名使用Sandbox买家批准及首笔付款，验证自动开通/取消；核对官方Subscriptions支持的续费失败与恢复测试方法，按真实产品能力执行，不虚构Test Clock、不以伪造Webhook或本地替身代替官方周期。等待较长、权限不足或服务不支持时标BLOCKED/NOT_RUN并记录下次可验证时间和条件，不重复扣款或忙等。

尽可能扩展：付款放弃/取消、拒付或认证失败、重复点击/并发结账、重复与乱序事件、错误签名拒绝、回调中断及恢复/对账、跨组织隔离、价格/币种/周期一致、双渠道互斥、取消及权益恢复。按能力区分官方沙盒实测、隔离本地fixture与未运行，破坏性回调中断仅在自有隔离测试端点做，不停用线上共享回调、不伪造供应商事件。人工对账恢复与自动Webhook成功分别记录；保存脱敏交易/订阅/事件标识、环境、时间、截图、权益前后及清理证据。

先检查前次接力是否已执行，避免重复购买；只新增为覆盖缺口所需的测试订阅并清理。新增独立支付重验报告，逐项列PASSED/BLOCKED/NOT_RUN，保留历史证据。缺凭据时记录所需私密配置路径/字段，继续其他独立工作。任务调度仍为2026-10-28北京时间00:42及05:44，不新增重复任务。

## 2026-10-28 00:42接力最新结论

先读evidence/collaboration/RELAY-2026-10-28-0042.md。本轮20稿校验和Web26/26通过；当前固定域名登录合成账号成功，但Stripe/PayPal configuration路由均404（源码有路由），阻塞当前官方沙盒环境确认及完整付款重验，未创建订阅或扣款。下一接力优先诊断实际部署版本/模块/路由，不能把404当作供应商拒绝或历史通过当现在通过。不为绕过此问题切Live。API测试长时间未汇总，必须查退出码再判断；完整数字人浏览器、构建及Git归档仍未完成。本轮自动任务管理工具不可用，未删除自身，未直接修改调度文件，COUNT=1保留。

00:42收尾更正：API支付测试已最终正常退出，联合Stripe/PayPal 17/17，Stripe串行复核10/10；属于既有dist+供应商替身，不能替代官方沙盒实测或源码重建。git diff --check退出0，仅CRLF提示。未留下本轮运行的支付测试进程。

## 2026-10-28 05:44接力收尾（以此为最新状态）

读evidence/collaboration/RELAY-2026-10-28-0544.md：找到线上支付404源码根因BillingModule未注册Stripe/PayPal Controller及Service，已本地补齐，并补Compose安全默认空凭据注入。实际本地HTTP两路由200且禁用；未部署，线上问题不能宣布解决，官方沙盒未付款。

最终20静态稿完整本地闭环通过：后台筛选/知行预览保存刷新/Agent实际舞台、403权限与跨组织、400未知/自定义、409并发版本；截图复核发现原gallery卡片裁掉姓名，已修复自动行高，重验2/2。私有素材API/RLS回归1/1、跨租户过期清理20+1和21条原子审计通过。API源码类型检查和nest build通过；最终Next生产构建38页退出0（包含gallery修复）。API全量46过/1失败/6跳过，DOCX单项复核仍失败，约10秒解析异常；不改超时/不掩盖；旧隔离库缺invitation_delivery仍为已知问题。不得称全套回归通过，暂不部署。

最终服务按归属关闭，PG数据保留，四端口无监听，移除Next临时tsconfig路径。归档开发分支codex/digital-human-20261027、标签collabspace-20261028-digital-human-phase2-local（实际Git结果以工具输出/refs为准），不合并main。下一步先解决DOCX解析并核对邀请迁移，再规划支付修复的受控上线/官方沙盒完整验收；真人凭据/素材及正式VRM/捏脸资产依旧缺。此轮automation_update不可用，无法正式删除一次性任务，未直接改调度文件，COUNT=1保留。

最终补充：停止本轮所有服务和构建后，DOCX隔离单项1/1通过，全量API串行47通过/0失败/6跳过（44178ms），未改10秒限制；前面两次资源并行时失败保留，负载可靠性问题仍开放。源码58a6c21及phase2-local标签已推送并远端SHA确认，归档tar.gz SHA256 de84c67fabc8c98b9256c16ba8015751e89a299be993eff7d2a43a58178c25d5。最终空闲复核为追加证据提交，标签不移动。仍未发布，官方沙盒未付款，下一步先准备支付模块单独受控发布及测试环境配置核验，避免把数字人新SQL带入未经授权的生产迁移。

## 2026-10-28 已正式发布（覆盖前述未发布状态）

数字人基础/支付路由/DOCX已发布，见evidence/collaboration/DEPLOYMENT-PERSONA-2026-10-28.md；用户另行明确批准了两张persona表、权限/RLS/清理函数及配套口型列的附加迁移，先完成全库私密备份。API源码0daaeb5、镜像e5bbfc70a1c9、r20261028-01；旧镜像和备份保留，WS不变。真实供应商及官方沙盒凭据仍空，不能当作真实语音/真人/付款通过。

协作空间已按新指令合并富文本/Markdown入口，项目类型卡片直达编辑器；应用源码de082c0，前端dpl_5spsPt4k1AiWkxir67ecY8pWF8Zp / collabspace-mg9scybdw-purelamp.vercel.app已绑定正式域名。无API重启或SQL变更。本地8项交互+1项防重复核、26单元及38页生产构建通过；线上文档/Markdown及三类Office入口4项通过。记录evidence/collaboration/HUB-DIRECT-2026-10-28.md，剩余项见CURRENT-STATUS-2026-10-28.md。保留类型与Yjs内容，不做富文本/Markdown数据转换；通用新建仍可自定义名称，卡片不重复选择。

本轮归档标签collabspace-20261028-persona-hub-online；最终提交/推送/压缩包校验以实际Git与sha256文件为准。原单次接力00:42/05:44已通过恢复可用的automation工具删除，无重复调度。工作树另有RTC交接/relay文件，非本轮改动，保留不纳入。只关闭了自己14420端口本地前端，未停用其他项目服务。
