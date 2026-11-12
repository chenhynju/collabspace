# 2026-10-29 功能回归与真实多账号测试

环境：独立本地 Postgres 15570 / Web 14430 / API 14431 / Yjs 14432；合成 owner/member/foreign-owner，真实 JWT/组织 guard/数据库。LiveKit Cloud 与 ElevenLabs 使用本地私有配置，未记录密钥、未生产发布、未发送邮件、未拍摄真人或真实桌面。

Node22 = C:/Users/chenh/AppData/Roaming/nvm/v22.20.0/node.exe。下述 node22 均指该实际路径。

| 命令/证据 | 结果 | 范围 |
|---|---|---|
| apps/api: node22 node_modules/@nestjs/cli/bin/nest.js build | PASS exit0 | 当前 API 编译 |
| node22 --test --test-reporter=spec apps/api/tests/*.test.cjs | PASS exit0 | 65条：59通过，6条件跳过，0失败；.test-runs/feature-audit/api-tests.log |
| Web 单元测试 | PASS exit0 | 26/26，运行日志见本地 audit 目录 |
| node22 .test-runs/feature-audit/run-collab.cjs | PASS exit0 | 29/29，实际独立 DB，collab-real.log |
| INVITATION_TEST_CONFIG=独立config + invitations.integration.test.cjs | PASS exit0 | 真实邀请数据库状态、加密outbox及收件人RLS，console邮件 |
| node22 scripts/test-meetings-http.cjs | PASS exit0 | 尚未注入LiveKit时跑真实HTTP/DB；鉴权、拒绝、幂等、聊天、结束后拒绝；meetings-http.json |
| tenant-isolation / presence-comments 浏览器重跑 | PASS exit0 | 2/2，真实数据库/双浏览器；browser-recheck |
| meetings.fixture / persona-motion.fixture 浏览器 | PASS exit0 | 4/4；明确 API 替身/合成媒体，不作真实多账号通过 |
| node22 scripts/test-voice-multiaccount-real.cjs | PASS exit0 | 真实应用API→DB→ElevenLabs TTS/STT，各一次；另一个账号读任务及音频404；voice-multiaccount.json |
| rtc-multiaccount.real.spec.cjs -g 'protect avatar' | PASS exit0 | 两真实账号浏览器聊天与刷新历史；20款形象配置、403、409；real-chat-persona-recheck |
| voice-application.real.spec.cjs | PASS exit0 | 浏览器真实 MediaRecorder 录制合成文件→WAV→实际应用→ElevenLabs→可编辑草稿；未自动发消息；真实TTS播放并停止。2次付费请求无重试，real-voice-ui |
| rtc-multiaccount.real.spec.cjs -g 'exchange LiveKit' | FAIL exit1 | 三轮真实应用媒体测试；首次双向视频帧/音频轨道及摄像头开关通过，屏幕共享接收失败；后两次视频存在但无帧。失败trace/screens保留在 real-multiaccount、real-multiaccount-recheck、real-media-visible |
| Web tsc --noEmit | PASS exit0 | 类型检查 |

媒体失败记录：LiveKit 客户端报 peerconnection failed、ping timeout、ICE restart、full reconnect；后续 settings/regions 401 出现在断开及清理附近，不能单凭它断言根因。加大可见视口及滚入远端视频后仍复现无帧。测试只用合成摄像头/音频，getDisplayMedia 采用合成 canvas，不是系统屏幕选择器。清理中的截图显示过ENDING，随后实际API查询前三个媒体会议均为ENDED，Cloud listParticipants 返回not_found；不能把中间截图误判为永久结束失败。

追加诊断：强制relay运行仍失败；一次创建后的查询抢在异步POST完成前，修正测试为等待会议行可见后再查询，该次relay未实际测到媒体。real-media-relay-recheck FAIL exit1，共享第二轨道未收到；real-media-diagnostics FAIL exit1，共享接收通过但停止后远端第二轨道未及时消失，UI显示negotiation timed out并重连，清理HTTP201。real-media-no-trace FAIL exit1，关闭trace后实际共享接收及停止均通过，但暴露了通话与聊天同时开启后的两个输入框。不能据此归因所有网络问题为trace开销。

已修复明确产品缺陷：ProjectMeetings 中 MeetingChat 和 MeetingCall 作为兄弟节点用了同一个meeting.id key，React重复key导致聊天DOM重复。改为chat:/call:独立key，并新增真实多账号断言聊天输入框仅一个。real-media-key-fix 全媒体重跑仍FAIL exit1（初始远端视频无帧，尚未进入聊天），媒体稳定性仍未通过。Web单元26/26、tsc --noEmit均重新PASS exit0。M3仍保持未验收，不可改断言掩盖失败。

修复回归：RTC_CHAT_ONLY=1，RTC_VOICE_REAL_TEST=1，COLLAB_BROWSER_CONFIG=.test-runs/feature-audit-20261029/config.json，node22 node_modules/@playwright/test/cli.js test rtc-multiaccount.real.spec.cjs -g 'exchange LiveKit' --trace=off --reporter=list --output=.test-runs/feature-audit/real-call-chat-key-fix，PASS exit0，35秒。此模式实际两个账号登录并连接LiveKit，保持麦克风/摄像头关闭，验证同时入会+各自唯一聊天框、消息跨账号可见、刷新历史、主持人结束移除通话；不把该模式当成媒体重跑通过。

缺陷修复：scripts/local-up.cjs 原本没有应用 deploy/collabspace/apply-invitations.cjs，实际测试报 relation invitation_delivery does not exist；加入迁移后邀请集成通过。tenant-isolation 旧协议2改为当前4；presence-comments 在线文本从旧精确值改为当前带人数格式，这两项为测试契约漂移。

未运行：实体麦克风/摄像头、OS屏幕选择器、系统音频、跨地区长通话、会中撤销成员、录制回放（超出M3）、原创可动形象与精确嘴型、真人分身、生产部署/真实支付。没有将 API 200、媒体轨道元素或静态图称为这些功能通过。

收尾：.test-runs/feature-audit/cleanup-rooms.cjs exit0，11个本轮合成会议业务状态均确认ENDED，限定这些会议哈希的Cloud房间剩余0（cleanup.json）。仅停止已核查父进程/命令的本轮API、Web、协作进程；pg_ctl对精确审核路径执行fast stop exit0，测试数据目录保留。15570/14430/14431/14432无监听、自有PID均不存在；自有WSL Redis6399记录05:55:38 user requested shutdown / ready to exit，原进程exit0。本地服务包装进程因主动停止exit1，不计测试失败。移除本轮Next自动加入的tsconfig缓存路径，保留原配置；最终git diff --check exit0。

本地WSL Redis无法稳定从Windows进程访问，API记录ECONNREFUSED/ECONNRESET；聊天浏览器验证允许实际轮询回退，未独立证明Socket提示实时推送或Redis可用。不得把这一环境的Redis/OAuth标为通过。
