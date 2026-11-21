# RTC / 语音 / 数字人接力主交接

## 最新：Tripo配置与USD20预算

用户填写Tripo凭据，provider=tripo3d，明确总预算USD20；已只更新预算项，上传/启用仍false，未生成/外发。新增只读账户检查和三款本地试制草案，详见[草案](TRIPO-PILOT-PLAN.md)与[本轮证据](../../evidence/collaboration/RTC-CONFIG-UPDATE-2026-10-29.md)。本机DNS/连接失败阻断鉴权，不能声称Key/余额已验证。官方当前基础单次生成+身体绑骨三款预估USD1.65，非完整脸部资产报价，最终格式待定。

前轮唯一遗留ENDING会议本次实际已ENDED，有server-monitor系统审计，旧pending待办已关闭。没有手改状态；独立Cloud清单仍未验证。用户问免费方案，已核对VRoid本地免费、Meshy网页100credits/月但API需付费、Tripo网页/API账本分开；不据旧宣传承诺该账户API赠送余额，不擅自改路线。

## 用户手动继续：2026-10-29

用户确定海外服务试制知夏/知行/明悦，供应商、预算另定。已在ignored third-party.env追加10项3D规划占位：route/角色/风格确定，provider/budget/format空白，enabled/uploadApproved=false，Meshy/Tripo Key空；原值逐项不变，重复执行不重复追加。尚无适配器读取，不会自动上传扣费。

只读LiveKit管理重试PASS；meeting-ending真实恢复专项PASS exit0（Cloud建房、后台ENDING完成、房间删除、系统审计、幂等结束）。追加双浏览器断线复测因本地DB超时FAIL，90秒媒体中止NOT_RUN。隔离API健康曾超时，停止自有Web/Yjs后恢复；不得伪称网络根治。

最近清理24场限定测试会议，成员ACTIVE，1场ENDING；结束重试503、Cloud list TLS失败，UNKNOWN，不能直接改ENDED。详见[人工重试报告](../../evidence/collaboration/RTC-RETRY-2026-10-29.md)及ignored `.test-runs/rtc-retry-20261029/cleanup-final.json`。没有新增定时任务/生产部署。

## R4 收尾：2026-10-29

本轮新增证据见 [R4报告](../../evidence/collaboration/RTC-VOICE-PERSONA-R4-2026-10-29.md)。默认网络策略下双账号实际音视频90秒持续收流、摄像头开关、共享画面/停止、持久聊天/刷新及主持人结束确认ENDED均PASS（media-default.log，exit0）。TCP诊断同样90秒收流通过，但首次结束503、DB为ENDING，旧测试误报；现已修复测试必须确认结束接口201/status=ENDED，不能只看通话面板消失。该场真实重试201/ENDED。

新增服务器对已持久化ENDING意图的Cloud撤权/删除重试与系统审计，不把未知RPC结果改成ENDED。会议单元测试6/6和API构建PASS。真实恢复专项两次失败，第二次保留原始原因：createRoom之前TLS连接断开；清理end503。没有进入后台恢复验收，不宣称真实恢复通过。媒体结束脱敏日志定位到list-participants/revoke-participants阶段，网络根因未关闭。

R4一次性调度已实际删除（automation_update返回deleteStatus=deleted）。当前用户明确要求继续，保留chat供后续操作，不归档。20原创可动模型仍0，未上传源图、未付费建模、未重复语音合成；不擅自安排无限续跑。最终运行进程/Cloud清理确认以R4报告收尾条目为准，未确认项必须保留，不盲目应用旧PID或把ENDING直接改成ENDED。

## R4 原执行记录：2026-10-29 12:00

runId=rtc-r4-20261029-1200，当前chat不变，前轮已释放锁。先核查工作树，保留共享未提交改动；本轮仅复用独立15570/14430/14431/14432/Redis6399，重新记录自有PID。最晚16:50收尾。官方5小时额度已用38%，剩余62%，未触发7%阈值。不重复语音收费短样本、不上传源图、不生产发布；先排查媒体网络和联合验收，缺模型/预算时继续独立软件工作。

## R3 执行记录：2026-10-29 07:00（已收尾，执行锁释放）

runId=rtc-r3-20261029-0700；chat=01a181d5-06a6-7270-b9a8-68dc954205c2；分支codex/digital-human-20261027，HEAD1893a4b。保留全部共享脏改动。前轮已释放锁；本轮复用独立feature-audit-20261029数据库，端口15570/14430/14431/14432，仅处理本轮启动的PID。最晚11:50收尾，12:00下一轮。官方5小时额度已用54%，剩余46%，未触发7%阈值。首先针对短期凭证与网络重连边界开展实际诊断，不重复ElevenLabs付费短样本。

R3中用户新要求：20静态图全部制作对应的可动三维/声音口型，捏脸若有效可行则开放。先前知夏/知行/明悦三款仍为试制顺序。用户没有3D服务账户/Key，询问网址后已提供Meshy/Tripo国际版及API链接；尚未给出试制预算或对指定服务上传这三图的授权，不能付费开通/上传。新增[20款制作入口](AVATAR-20-PRODUCTION.md)及源图哈希清单，全部SOURCE_READY，原创定制可动模型仍为0。

R3已推进独立可做部分：官方Rhubarb1.14 Windows本地工具（约239MiB含ZIP），现有ElevenLabs中英WAV真实离线分析，不再次TTS；新增本人TTS补口型接口、每进程最多2个、临时音频删除、重复复用、跨账号404，以及实验室原音频驱动VRM样例。基础音素非逐字精确；用户私有配置仅新增两项非secret启用/路径，其余解析值逐项保持。真实浏览器音画、暂停/重播/离开通过；还修复了VRM待机举手和同一audio快速重播被旧release暂停的问题。样例仅第三方技术资产，不冒充20款成品。详细结果见R3证据。

R3最终证据：[R3报告](../../evidence/collaboration/RTC-VOICE-PERSONA-R3-2026-10-29.md)。API构建PASS；最终全量70条62通过/8条件跳过/0失败，真实Rhubarb另3/3通过；Web28/28和tsc通过。早期全量DOCX负载超时曾失败，单独及最终完整重跑已通过，未改超时。真实服务器停用成员踢出/旧票拒绝与重新鉴权入会2/2通过，真实Redis/Socket提交提示/跨组织拒绝通过。全媒体核心流程通过一次，增强复测仍麦克风发布超时，90秒持续媒体NOT_RUN；R4不得把一次PASS视为稳定性根因已修复。

R3一次性调度已由automation_update(mode=delete)确认deleteStatus=deleted，未取消R4。已保存33个当前源码/证据文件快照及tracked差异到.test-runs/rtc-r3；它们包括前轮共享内容，是恢复快照而非R3独立提交，不能盲目应用覆盖他人工作。无git add全部/强制提交。最终diff --check通过，Next自动类型缓存路径已恢复。

R3清理：首次HTTP清理timeout后，重启独立PG只读核查+限定Cloud清理，18个指定合成会议均ENDED、Cloud对应房间0、测试成员ACTIVE（.test-runs/rtc-r3/cleanup-final.json）；PG已再次fast stop，API/Web/Yjs/WSL Redis均停止，数据保留。原始配置/下载工具均在ignored目录，未提交密钥或生产发布。当前chat保留给12:00的R4 heartbeat，不归档；下一轮独立chat未获确认。

R4恢复：.test-runs/rtc-r3/run-stack.cjs启动15570/14430/14431/14432；该测试栈初始API没有访问复核开关，需核查并停掉它自己刚启动的API子进程，再启动run-api-mouth.cjs（单独API，MEETINGS_ACCESS_MONITOR_ENABLED=true、本地Rhubarb、认证Redis）。该API辅助脚本故意SPEECH_PROVIDER=azure且没有Azure Key，避免重复云费用；复用成功TTS做口型无需云Key。若确需新真实语音测试，按本地private配置显式选择ElevenLabs及其所需字段，限定请求量。Redis需启动本轮配置的WSL原生6399，确认ready和带认证Windows PING后再启动API，不能抢跑或把接口地址探测失败当永久不通。参考本轮helper与证据；每次启动重新记PID，不能复用旧PID清理。缺Redis可单机Socket降级，但不得冒充多节点验证。

正式20款模型仍未交付。取得生成服务账户、预算及三张指定图外发授权前不上传；源图清单可用但不是生成器。第一款正式资产接入还需可信模型目录/能力验证，不能直接把第三方样例填进20个条目；捏脸若无有效变形不开放。优先读取用户新答复，不重复要求用户已经回答过的视觉方向和三款选择。

## 2026-10-29 手动功能审计 / 多账号测试

用户追加真实多账号测试，执行详情见 [功能盘点](FEATURE-INVENTORY-2026-10-29.md) 和 [证据](../../evidence/collaboration/FEATURE-AUDIT-2026-10-29.md)。05:42官方5小时额度已用44%，剩余56%，未触发7%规则。独立数据库feature-audit-20261029，15570/14430/14431/14432；禁止对其他任务或线上做清理。

已通过真实应用ElevenLabs TTS/STT、跨账号任务/音频404隔离；真实浏览器听写回填可编辑草稿不自动发消息、TTS播放/停止通过。本轮4次短合成请求，无重试，无个人录音。聊天双账号刷新恢复及20静态形象配置权限/版本冲突通过。LiveKit多账号首次实际帧接收通过但共享失败，后续出现无帧/ICE/ping超时，M3未完成。不能拿旧SDK短测替代本次失败。下一轮先诊断网络/共享/长通话和会中撤权；数字人最终原创精致卡通成年模型、精确嘴型仍未完成。

修复local-up邀请表迁移遗漏；修正两个旧浏览器用例契约漂移。新增真实测试默认skip，须显式RTC_VOICE_REAL_TEST=1，config必须为独立localhost:14431；避免自动重复收费。测试失败trace含短期令牌，只保存在ignored .test-runs，不可提交/外发。

05:55追加：关闭trace的运行实际共享接收/停止通过过，随后发现真实UI缺陷：MeetingChat/MeetingCall兄弟节点同key导致重复聊天DOM，已改chat:/call:。RTC_CHAT_ONLY=1真实双账号连接回归PASS exit0（媒体关闭，仅验证连接中唯一聊天、同步/刷新/结束）；全媒体修复后仍可能无帧/重连，不能以聊天专用模式当媒体通过。Web26/26及tsc重新通过；剩余核心阻塞是媒体稳定性与长期/撤权验证，最终原创3D和精准嘴型仍未完成。

本次手动审计已收尾并释放执行锁：11个合成会议确认ENDED、对应Cloud房间0；自有API/Web/Yjs停止、Postgres fast stop、WSL Redis6399自身退出，数据和失败现场保留。15570/14430/14431/14432均无监听，本轮Next类型缓存路径已从tsconfig移除，diff --check通过。后续R3/R4依赖当前chat，继续保留不归档。优先复用失败证据诊断媒体协商/网络，不要无理由重复ElevenLabs收费请求。Windows→WSL Redis在本环境不稳定，Socket实时提示尚无独立验收，聊天持久化/轮询恢复已通过。

最后更新：2026-10-28，R1开发与验证中。

权威任务范围与收尾规则：[四轮计划](RTC-VOICE-PERSONA-RELAY.md)。

新增用户要求：提前说明第三方配置。已整理[逐步开通和本地存放指南](THIRD-PARTY-SETUP-RTC-VOICE-PERSONA.md)，模板在templates/third-party.env.example；本机空白文件`.test-runs/private/third-party.env`按不存在才创建。R1先核对用户填写状态，不打印值；需用户提供Azure资源/LiveKit路线、真人资格/素材授权与试验预算。模板不是已配置或已接通证据。

## 当前调度与执行

- 调度：2026-10-28 21:40左右补设R2/R3/R4，工具均返回Created / ACTIVE。ID分别为collabspace-rtc-r2-10-29-2、collabspace-rtc-r3-10-29-7、collabspace-rtc-r4-10-29-12，单次COUNT=1，02:00/07:00/12:00。本轮R1为手动继续，21:00未按时自动启动；不得补称已准时执行。
- 时间：R1 10-28 21:00；R2 10-29 02:00；R3 10-29 07:00；R4 10-29 12:00，全部Asia/Shanghai。
- 用量：2026-10-28 21:36北京时间官方工具返回5小时usedPercent=2，即剩余98%；后续须重查，不声称已触发7%规则。
- 归档：后续调度均为当前chat的heartbeat。为保留后续唤醒，不自动归档当前chat；先保存交接。若改为独立新chat接力，须先确认独立任务已注册再归档。当前工具已可用。
- 执行锁：无本专项执行轮次持有；每轮开始需现场核查，不将本条视为永久事实。
- 代码基线：准备时codex/digital-human-20261027 / c3442c1；工作树有其他改动，必须重查。

## 进度

| 项目 | 状态 | 下一步 |
| --- | --- | --- |
| RTC M1 | 实现，部分验证 | 授权/创建/结束恢复真实SQL测试PASS；UI与真实API仍需验证 |
| RTC M2 | 实现基础通话，未验收 | LiveKit入会、轨道、音视频/共享开关已有；真实双账号媒体未测 |
| RTC M3 | 实现中，未验收 | 共享开关和PostgreSQL持久聊天已有；补测数据库和浏览器 |
| 真实STT/TTS | NOT_RUN（本专项） | 核对实际凭据及地区，验证完整输入/播放链路 |
| 卡通可动/捏脸 | NOT_RUN（本专项） | 重查正式模型/动作/表达资产和真实行为 |
| 真人照片/视频分身 | NOT_RUN（本专项） | 重查供应商资格、适配器、本人授权素材及预览确认 |

历史数字人交接曾记录Azure/真人资格、正式VRM与捏脸资产缺口；仓库已有较新的线上验收提交和截图，必须读取最新证据后判定现状，不能从旧交接直接宣布仍阻塞或已经可用。

## 每轮收尾必须替换/追加的内容

- runId、轮次、当前chat标识、开始/结束、下一轮时间、锁持有/释放。
- 本轮源码提交或补丁路径、实际修改文件；保留的共享脏改动。
- P/BR/D/AT覆盖、PASS/FAIL/BLOCKED/NOT_RUN矩阵和证据链接。
- 当前执行命令与退出码；未完成进程是否仍在运行；自有端口/数据库/恢复命令（不含秘密）。
- 官方额度剩余及采样时间/来源，或QUOTA_UNAVAILABLE。
- 具体阻塞：缺哪些凭据/资格/资产/授权/人工验收；已完成的独立工作。
- 下一轮先做的三件事、禁止重复的操作、待验证外部操作ID/幂等键。
- 归档动作结果或ARCHIVE_BLOCKED；任务注册ID与一次性执行状态（工具可用时）。


## R1 实际改动（2026-10-28）

- 后端meetings模块、LiveKit SDK、项目会议页、默认关闭的开关；短期token、主机结束ENDING恢复、事务审计、组织/项目权限与RLS。
- 新增rtc_meeting与rtc_message增量SQL，挂入迁移脚本；未应用生产数据库。消息幂等、复合游标、结束只读、限速；前端纯文本、历史恢复与轮询。
- 修复StrictMode重复连接生命周期；RoomServiceClient结束请求10秒超时。
- 既有20个静态形象保留复用，不要求重新制作。可动模型/真人分身未完成；Azure/LiveKit配置当前为空，不打印凭据，不开通付费服务。
- 已确认前一版API类型检查exit0；后端输入/JWT单元2/2；会议生命周期真实PostgreSQL脚本exit0（媒体是fixture）。最新聊天变更后的检查须以收尾记录为准。
- 当前源码尚未提交；使用git status和diff复核，不覆盖其他chat工作。隔离测试目录.test-runs/rtc-r1-sql、web .next-rtc-r1；无生产发布。
- 下一步：完成聊天SQL与浏览器fixture、真实HTTP授权回归；准备本机LiveKit或用户Cloud配置做双上下文音视频/共享；有Azure配置后验证真实录音识别和合成播放。


## R1 最新验收记录

- API TypeScript noEmit：最新代码 exit0。
- Web TypeScript noEmit：聊天与StrictMode修复后的代码 exit0。
- Node22 `--test apps/api/tests/meetings.test.cjs`：2/2 PASS，exit0。
- Node22 Playwright `test tests/browser/meetings.fixture.spec.cjs --reporter=line --output=.test-runs/rtc-browser`：1/1 PASS，exit0（4.5分钟）。仅mock API的界面流程，覆盖创建/未配置禁入会/聊天恢复/结束只读，不是实际媒体或HTTP授权证明。
- 聊天版真实SQL断言已全部PASS；Windows embedded-postgres原关闭逻辑产生孤立io_worker，已按已核对的本专项二进制与进程父子关系停止该孤立进程，未操作其他数据库。测试脚本改用pg_ctl graceful stop，重跑所有业务/聊天断言PASS、graceful stop PASS、正常exit0。
- 隔离Next服务14420已停止；恢复Next自动加入的tsconfig路径，未删除缓存或用户文件。
- git diff --check：exit0。
- 当前仍未验收：真实HTTP双用户全流程、LiveKit双人媒体/屏幕共享/撤权，真实Azure识别与播放，可动数字人与真人分身。不得将本轮写为M3全面完成。


## 用户配置后续验证：2026-10-28 23:44 Asia/Shanghai

- 用户已在ignored私密文件填好LiveKit URL/Key/Secret；仅检查SET/EMPTY，不输出值。Azure Key/Region仍为空。
- 私密文件未设置LIVEKIT_DEPLOYMENT/MEETINGS_ENABLED；真实验收脚本只在进程内选择cloud并启用，不改文件或生产开关。
- `node22 scripts/test-meetings-live.cjs`第一轮正常exit0：真实LiveKit云服务鉴权、双浏览器合成音视频发布/订阅、远端视频解码、audio/video接收bytes>0、服务端结束后双方断开，全部PASS。
- 实际供应商媒体测试，非模拟API；同时不是产品HTTP授权、真人设备、系统屏幕选择器或生产部署验收。测试房间已删除，浏览器及临时HTTP服务已关闭。
- 脱敏结果保存在ignored `.test-runs/rtc-live/result.json`。源码脚本不含长期密钥、不输出token或媒体URL；只读用户准备的私密文件。
- 正在追加合成画布作为ScreenShare源的发布、远端解码及停止共享测试；不得等同于真实系统屏幕选择器通过。


### 23:48 后续媒体结果

- 带屏幕轨道的第一次补测在接收阶段TimeoutError，仅vendorAuth通过，exit1；测试房间清理成功。保留该失败，说明网络/媒体稳定性尚未验收。
- 加入阶段标识与脱敏诊断后重试，exit0：双端音视频收发、真实接收bytes、视频解码、合成画布ScreenShare远端解码、停止共享远端撤轨、服务端结束双方断开全部PASS。单次通过不证明稳定性或真实系统屏幕选择器。
- 新脚本scripts/test-meetings-live.cjs每轮保留独立JSON证据，不含密钥/token/媒体URL。没有采集本人摄像头/麦克风/桌面；仅合成信号。
- Web通话新增“启用扬声器”入口，自动播放受阻时保留连接供用户手动恢复，不把自动播放权限失败误当作入会失败。
- 下一轮仍需真实应用HTTP端到端、设备选择与系统共享、断线恢复/撤权；聊天当前3秒轮询，Socket.IO提示尚未接入。Azure仍无Key/Region，ASR/TTS真实调用未执行。


## 2026-10-29 首个真实三维可动角色

用户“做吧”授权开发。新增MotionStudio.tsx与/personas/studio，AgentAppearanceSettings提供入口。原创程序化关节机器人，Three.js网格、灯光、阴影、关节摆动；待机/走路/挥手/点头、键盘平面移动、视角旋转缩放、换色和重置。不是20张静态图的三维转换，也不是完整VRM/真人分身交付。

真实Edge WebGL浏览器测试：persona-motion.fixture.spec.cjs 1/1 PASS，exit0，1.2分钟，验证真实canvas画面变化、键盘移动坐标、重置和动作切换。登录/API为fixture，不证明真实账号后端验收。初次测试误将Next空alert当业务错误已修正为角色实验室内检查。

实机截图：.test-runs/3d-agent/studio.png。专项范围与边界：PERSONA-MOTION.md。尚未生产发布。现有会议/配置改动保留，未读取或更改用户密钥。

最终Web TypeScript noEmit exit0；git diff --check通过。已停止本轮隔离Next进程14420并移除其自动添加的tsconfig缓存路径；保留截图及构建缓存供下一轮复用。


三款原图参考三维试版：知夏、知行、明悦已实现选择卡及程序化人物关节模型，三款切换/动作/位置复位真实WebGL测试最终1/1 PASS exit0（48.9秒），类型检查exit0。目视发现明悦卷发遮眼，已修正前额发束并重测。截图.test-runs/3d-agent/female-02.png、male-01.png、female-06.png。保留原图，未声称高保真重建；原图未给出的全身/背面为补充设计。隔离Next已停止，tsconfig自动缓存路径已恢复。


## 2026-10-29 数字人继续开发与语音替代

用户否定旧几何人观感，要求继续数字人并在Azure不可用时换ASR/TTS技术。默认舞台改成完整VRM蒙皮/贴图/表情验证资产，原先三款仅对比入口。来源/许可/哈希见public/personas/models与PERSONA-MOTION.md。第三方日系测试模型不算自然人形定制完成，不是20个原图重建。自然人形方向已准备知夏建模参考三视图，docs/collaboration/assets/zhixia-turnaround-v1.png；built-in imagegen生成，提示词同目录md。它是位图，不是可动模型。正式建模/骨骼绑定/美术验收仍缺。

语音新增SPEECH_PROVIDER=azure|volcengine，默认Azure，显式选择后才调用豆包中国区。录音极速识别与TTS SSE PCM→WAV，结果校验/体积限制/取消/不重试。网页显示选定供应商和地区。新增speech_route配置指纹，任务创建与队列执行一致才允许外发；旧排队任务无指纹或变更配置进入UNKNOWN，需核查新建。

验证：speech-alternative.test.cjs 5/5 PASS exit0（模拟供应商协议，不是真实音质/识别效果）；真实PostgreSQL脚本含voice.sql新增列与重复迁移PASS，会议/聊天回归PASS，正常关闭exit0；API与Web类型检查exit0；浏览器旧原型+真实VRM 2/2 PASS，近景调整后VRM专项1/1 PASS（36.8秒）。最新播放总线连接后Web类型检查收尾另记。无真实豆包调用、未开通付费资源、未上传素材给3D供应商、未生产迁移/发布。

豆包配置/开户指引已追加第三方指南；现有私密文件未改，需用户开通语音Key、ASR极速权限、TTS2.0和匹配的中英文音色ID。图生3D可评估Meshy或Tripo官方图生模型→绑定→动作流程，尚未选择/开通或提交；需具体服务、素材授权范围与费用预算后执行。原图文件及其他任务改动保留。

最新Web类型检查（含播放总线连接）exit0；git diff --check通过。已停止本轮Next14420，恢复其tsconfig缓存路径；隔离PostgreSQL已正常关闭。


## R2 开始：2026-10-29 02:08 Asia/Shanghai
runId=rtc-r2-20261029-0208，chat=01a181d5-06a6-7270-b9a8-68dc954205c2；本轮独占专项，已有未提交改动全部保留。官方5小时额度已用47%，剩余53%，未触发7%规则。最晚06:50收尾，下一轮07:00。当前本轮自有Next14420/.next-rtc-r1，首项补M2设备预览/选择/权限拒绝/释放。用户已确定精致卡通人形、成年比例，覆盖此前自然写实方向；日系第三方模型仍仅技术验证，不是最终美术。


## R2 收尾
本轮实质进度与命令见evidence/collaboration/RTC-VOICE-PERSONA-R2-2026-10-29.md。新增海外主选ElevenLabs，豆包备用；未读取或写入真实语音Key，真实调用BLOCKED。入会设备检查、提交后Socket提示、Cloud旧令牌重入修复及真实复测已完成对应验证。用户视觉方向为精致卡通人形、成年比例，定制资产仍未完成。R2结束后删除自身一次性调度，保留R3/R4；它们依赖当前chat，因此不归档。自有进程清理完成后释放本轮锁，下一轮继续HTTP集成、会中撤权和真实语音。


R2配置后进展：用户已填ElevenLabs Key，两个voice占位已仅定向替换为账户可用的Sarah预置ID，其他配置保持。真实TTS→ASR中文、英文共4次请求全部PASS exit0（合成短语音，无个人录音）；旧“真实语音BLOCKED”记录由本条更新为供应商短样本PASS。应用端到端与真人录音仍未验收。下一轮避免无理由重复付费短样本，优先复用.test-runs/speech-live的音频做产品测试。

R2本轮自有Next14420已停止，tsconfig自动缓存路径恢复；PG已正常关闭，测试浏览器和Cloud合成测试房间均清理。R2一次性自动化已由工具确认deleteStatus=deleted；R3/R4保留。当前chat因后续heartbeat依赖保留，不归档；R2执行锁释放。

`node22 scripts/test-speech-playback.cjs` exit0：真实Edge对两段供应商WAV解码、播放进度、暂停和重播均PASS；复用现有音频，无新增供应商请求。非主观听感或完整产品页面验收。git diff --check exit0。
