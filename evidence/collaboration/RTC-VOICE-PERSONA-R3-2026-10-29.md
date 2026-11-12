# RTC / 语音 / 数字人 R3 实施与验收

2026-10-29 07:00 Asia/Shanghai开始，runId=rtc-r3-20261029-0700；分支codex/digital-human-20261027，基线HEAD1893a4b。保留所有前轮/共享脏改动，无生产迁移/部署、无新付费资源、无真人素材外发。本轮没有调用ElevenLabs，沿用前轮真实应用语音证据。

## 实际开发

- 会议客户端新增“重新验证并入会”，清理旧Room后重新经当前用户/组织/项目鉴权签发；新Room不自动打开设备。异步startAudio完成时不把已断开状态误报为已连接。
- 新增服务器访问复核，每30秒轮转最多10场，不重叠；持久化已发凭证与撤权确认状态，启动后可恢复。每个主体在相应组织上下文复用ResourcePolicy和账号/组织/项目状态校验。Cloud RPC确认后才落撤权标记与系统actor=null审计；未知错误保留重试。
- `rtc_access_candidates()` 为无输入、固定search_path、PUBLIC无权限的有界维护枚举，不返回聊天内容；普通业务RLS不放宽。新增SQL只应用于隔离数据库。
- 必须开启MEETINGS_ACCESS_MONITOR_ENABLED并有90秒内成功复核，才提供入会；缺迁移/未启动/长期失败不继续签发。状态说明可见。API/DB/供应商全面中断时不能保证已有媒体瞬时终止，不声称任意规模30秒完成。
- 入会JWT由60秒改600秒，覆盖官方5分钟刷新间隔；不以此宣称网络故障已修复。参见[官方token生命周期](https://docs.livekit.io/frontends/reference/tokens-grants/)。Cloud显式cutoff撤权保持，实际旧票401不靠票据过期。
- 媒体DOM增加轨道来源标识；真实测试检查音视频实际接收字节、音频播放进度、共享视频解码，并支持最多180秒短时持续采样。

## 命令和边界

node22指C:/Users/chenh/AppData/Roaming/nvm/v22.20.0/node.exe。隔离环境复用feature-audit-20261029，PG15570/Web14430/API14431/Yjs14432；真实合成owner/member/foreign账号，测试配置在ignored .test-runs，不能提交JWT、原始密钥或运行时Redis随机密码。

| 实际执行 | 结果 | 范围 |
|---|---|---|
| node22 --test apps/api/tests/meetings.test.cjs | PASS exit0，5/5 | 凭证grant/600秒、Cloud结束顺序、撤权失败重试/未知DB不成功、复核关闭时拒绝签发；meeting-tests-final.log |
| node22 .test-runs/rtc-r3/apply-monitor.cjs | PASS exit0 | 真实附加SQL，应用角色可调用维护函数，批次<=10 |
| node22 scripts/test-meetings-live.cjs | FAIL exit1 | 真实Cloud SDK短测，无远端稳定媒体，stage=remote-track-reception，cleanup=deleted；不是应用M3通过 |
| meeting-recovery.real.spec.cjs（首次） | PASS exit0 | 实际Cloud断开后授权成员重新入会，停用成员新请求403 |
| meeting-monitor.real.spec.cjs（首次） | PASS exit0 | 不运行应用心跳的纯SDK客户端，成员停用后被服务器踢出，旧600秒票401/403，DB撤权标记和actor=null审计确认 |
| node22 scripts/test-meeting-socket-real.cjs | PASS exit0 | 真实JWT/DB/Socket.IO，无轮询/接口替身；成员收到无正文的commit提示，能读取持久化消息；跨组织房间拒绝、无提示泄漏 |
| meeting-monitor.real.spec.cjs + meeting-recovery.real.spec.cjs（最终后端重跑） | PASS exit0，2/2，1.1分钟 | 启用复核健康门禁、真实native Redis后，服务器撤权/旧票拒绝与断开恢复均通过；final-security |
| rtc-multiaccount.real.spec.cjs -g 'exchange LiveKit' --trace=off | PASS exit0，35.4秒 | RTC_CHAT_ONLY未设置，全媒体：双真实账号入会、双向画面/音频轨道、开关、共享/停止、唯一聊天框、同步、刷新、主持人结束；full-media |
| RTC_SOAK_MS=90000 + 同上增强用例 | FAIL exit1，1.8分钟 | 第二个客户端麦克风发布超时，远端音频轨道0；没有进入字节/共享解码/90秒采样阶段，后三项NOT_RUN。media-soak保存现场；清理HTTP201 |

所有浏览器实际执行均显式RTC_VOICE_REAL_TEST=1、COLLAB_BROWSER_CONFIG=.test-runs/feature-audit-20261029/config.json，经真实应用API，无route.fulfill；使用合成摄像头/音频，屏幕是合成canvas，未抓取用户真实桌面。

本地Redis：最初绑定WSL接口地址的Windows探测失败；确认服务ready后，改成仅127.0.0.1、随机认证的自有Redis6399，Windows实际PING PASS，后端认证连接后无原先NOAUTH/ECONNREFUSED。没有修改全局WSL/网络/系统参数。此环境的单节点Socket验证通过，不等于多节点广播性能认证。

## 剩余边界

M3核心应用流程本轮通过一次，之前及本轮SDK媒体失败仍保留，不能单凭新样本声称网络稳定性根因已关闭。真实设备/OS屏幕选择器/系统声音、海外网络及长时间通话、各种项目ACL/组织/账号状态矩阵、监控故障与大规模延迟仍待专项验证。

增强复测暴露的具体错误为publication of local track timed out, no response from server：SDK仍报告connected，但麦克风未成功发布。客户端现在在这类协商/发布超时后也提供重新验证入口与明确提示；该额外提示分支经类型/编译检查，尚未再次诱发真实超时验证。已有真实断线后的重新验证流程2/2通过，不能把它写成网络根因修复或90秒稳定通过。

数字人：20款静态形象及配置沿用已有真实证据；VRM第三方技术样例仍不是最终原创精致卡通成年形象。没有最终对应模型/变形表情资产与真人生成资格/授权素材，不上传第三方、不伪造效果。原创3D/有效捏脸/精确嘴型/真人分身仍BLOCKED，不把本轮RTC进展称为总专项完成。

## 用户新要求与基础口型交付

用户在本轮要求20图全部生成对应的可动、声音口型角色，捏脸“若有可能”开放；已更新设计为有条件捏脸。用户确认没有建模账户/资源，询问网址后提供Meshy/Tripo国际版。尚无模型生成Key、试制预算和指定服务外发授权，未购买资源、未上传任何图片。新增AVATAR-20-PRODUCTION.md和20款实际哈希制作清单，当前20款仍SOURCE_READY、0个原创可动模型。

独立可做部分已实际实现：官方Rhubarb1.14本地音频分析→校验有限连续时间轨道→保存到原voice_job→按真实音频时钟驱动VRM。轨道标注rhubarb-phonetic-v1与endMs，不冒充Azure精确结果；基础5元音映射存在精度限制。新TTS可以尝试本地分析，失败保留已成功音频；本人已有成功TTS可POST /voice/jobs/:id/mouth-track补口型，不重合成。重复复用、重新鉴权、并发最多2个、60秒音频/执行上限和临时文件清理。用户私有配置只新增非secret的SPEECH_LIP_SYNC_PROVIDER/RHUBARB_BIN，其他解析值逐项保持。

| 命令/验证 | 真实结果 |
|---|---|
| node22 scripts/prepare-avatar-build-manifest.cjs | PASS exit0，20张独立哈希；未上传，未声称生成模型 |
| RHUBARB_TEST_BIN=本地真实exe + node22 --test apps/api/tests/phonetic-mouth.test.cjs | PASS exit0，3/3；中英已有音频真实分析、运行中及预先取消、临时目录无残留；phonetic-final.log |
| avatar-mouth.real.spec.cjs | PASS exit0；实际本人TTS补口型、其他账号404、重复结果复用、无POST voice/jobs、真实WebGL嘴部发音/暂停/重播/离开清理 |
| 待机手臂修正后同上 | PASS exit0，18.2秒；修正规范化骨骼旋转方向，待机不再举双手，截图经实际目视检查 |
| AVATAR_RECORD_DEMO=1 首次同上 | FAIL exit1，12.3秒；快速pause→play暴露旧release暂停同一audio的新播放，已修复character-playback和原生暂停/结束回调过期检查 |
| 修复后AVATAR_RECORD_DEMO=1重跑 | PASS exit0，真实嘴型及录制；video文件avatar-mouth-r3.webm，70,562字节；第三方VRM+原有合成音频，不是原图20个成品 |
| node22 .test-runs/rtc-r3/validate-demo.cjs | PASS exit0；录制文件真实播放解码1102x580、2.44696秒、音频波形peak RMS 0.30345，非只有音轨头 |
| API nest build（最终源码） | PASS exit0；初次Object.hasOwn不兼容ES2021失败，改hasOwnProperty后通过，无全局TS配置变更 |
| Web node22 --test tests/*.test.cjs | PASS exit0，28/28；包含同音频旧release不得停止新会话和长音素保持/闭口/暂停 |
| apps/web: node22 node_modules/typescript/bin/tsc --noEmit | PASS exit0；一次从根目录找错tsc路径exit1已纠正，未算成类型失败通过 |
| node22 --test --test-concurrency=1 apps/api/tests/*.test.cjs（早期67条） | FAIL exit1，60通过/1失败/6跳过；原有DOCX解析在并行负载下超时，单独重跑该测试PASS exit0，未提高超时掩盖 |
| 同上最终70条，停止自有服务后 | PASS exit0，62通过/8条件跳过/0失败，49.4秒；api-regression-final.log。两项真实Rhubarb用例默认跳过，实际exe另行3/3通过 |

不将短句嘴型轨道存在或状态变化算作音素准确率评测；当前实际浏览器嘴型复用英文TTS，中英文CLI均通过。所有预览仍为第三方样例，不改变正式20款静态目录。模型来源与许可：VRM1_Constraint_Twist_Sample ©2022 pixiv Inc.，详见apps/web/public/personas/models元数据及[VRM许可](https://vrm.dev/licenses/1.0/)。

## 收尾记录

首次基于HTTP的清理脚本TimeoutError exit1，未把未知结果写成成功。随后仅重启隔离PG做只读核查，分阶段校验Cloud：cleanup-database-cloud.cjs PASS exit0，18个本轮及前轮指定前缀合成会议均ENDED、对应Cloud房间0，暂停的测试成员已恢复ACTIVE；cleanup-final.json保留。PG再次fast stop，API/Web/Yjs及本轮WSL Redis均停止，原数据库与上传目录保留。临时口型分析目录取消测试检查无残留，无rhubarb进程残留。

本轮全程未触发剩余<7%阈值：开始剩余46%，阶段最低已读取剩余26%；窗口自然重置后09点阶段剩余71%，没有使用重置券。R4仍依赖此chat，保留不归档；R3一次性调度收尾时删除，不新增无限续跑。

automation_update(mode=delete,id=collabspace-rtc-r3-10-29-7)已实际返回deleteStatus=deleted；R4保留。源码/证据33文件与tracked diff已落.test-runs/rtc-r3快照，含原有共享改动，不是隔离提交。最终diff --check exit0；Next自动添加的本轮类型缓存路径已移除，私有配置与工具目录git check-ignore确认被忽略。
