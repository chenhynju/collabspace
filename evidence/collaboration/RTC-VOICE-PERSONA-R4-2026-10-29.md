# R4：RTC / 语音 / 数字人

本轮在原工作树保留共享改动，使用隔离feature-audit-20261029数据库及14430/14431/14432/15570端口；不生产部署、不新增语音合成请求、不上传20款源图、不付费开通建模服务。当前记录为执行中，最终结果待下文追加。

## 已核查与修改

- 原20款仍是静态图，无对应原创可动模型；本地配置仅检查建模Key是否存在，不输出值。Meshy/Tripo均未配置，不能把第三方VRM样例当原创交付。
- `scripts/local-up.cjs`支持显式`COLLAB_LOCAL_REDIS_URL`，只接受loopback redis/rediss地址；原默认值保留。避免启动脚本覆盖测试Redis认证配置。
- 真实双账号测试加入API/前端就绪门禁，检查`health/ready`响应内容，防止隔离栈未启动时直接创建真实媒体房间。
- 新增仅测试的`RTC_FORCE_TCP=1`，筛选供应商实际提供的TURN TCP/TLS地址并强制relay；不创造TURN账号、不修改产品默认网络策略。若供应商没给TCP relay，明确失败。
- 测试清理前保存脱敏PC状态、接收媒体字节/视频帧及候选传输类型；不保存IP、凭据、TURN URL到本报告。私有失败现场仍在ignored目录。

## 实际命令与结果（执行中）

node22=`C:/Users/chenh/AppData/Roaming/nvm/v22.20.0/node.exe`。

| 命令/行为 | 结果与边界 |
|---|---|
| `node22 --check tests/browser/rtc-multiaccount.real.spec.cjs` | PASS exit0 |
| `node22 --check scripts/local-up.cjs` | PASS exit0 |
| 中断后未恢复服务的真实媒体复测 | FAIL exit1，登录ECONNREFUSED14431；媒体NOT_RUN，未创建房间，不归因LiveKit |
| `node22 .test-runs/rtc-r4/check-redis.cjs`，恢复WSL原生Redis后 | PASS exit0，Windows带认证PING |
| `GET http://localhost:14431/api/v1/health/ready` | PASS，实际status=ok、database=up、redis=up |
| `RTC_FORCE_TCP=1 RTC_SOAK_MS=90000` 双账号真实应用测试 | 命令exit0、6.6分钟；实际90秒双向媒体字节增长、共享解码/停止、聊天同步/刷新通过。但结束请求503，数据库ENDING；旧测试误报总体PASS，本报告判定全流程FAIL |
| `node22 .test-runs/rtc-r4/retry-end.cjs` | PASS，真实重试HTTP201且status=ENDED；首次503根因尚未确认，不能宣称根治 |
| 修改后`node22 --test apps/api/tests/meetings.test.cjs` | PASS exit0，5/5 |

## 媒体首次结果与验收修正

首次TCP诊断90秒通过后，结束按钮使通话面板消失，但服务端仅ENDING。已修正测试：等待按钮实际POST响应，必须201且响应status=ENDED，列表也必须显示已结束。此后不能以面板消失代替供应商撤权与持久状态完成。

媒体结束失败新增脱敏阶段日志，只含固定stage、严格限定code、数值status；不记录SDK原始消息、URL、room、identity或凭据。重试成功只证明可恢复，首次失败尚无阶段日志，无法反推原因。

产品默认连接策略90秒完整复测PASS exit0，2.9分钟：实际双方持续收流、视频解码、摄像头开关、屏幕共享解码/停止、聊天同步/刷新、主持人POST结束201/status=ENDED、列表已结束、清理201。未强制TCP。此单次增强通过仍不等于长期与所有网络稳定。

## 后台结束恢复与最终结果

新增服务器访问复核处理已持久化ENDING意图：真实Cloud撤权/删除成功后才按组织条件更新ENDING→ENDED，并记录actor=null/source=server-monitor审计；失败保持ENDING，下次复核重试。不改变ACTIVE会议，不靠客户端在线。新增有界恢复测试。

- 会议单元测试：6/6 PASS exit0（meeting-unit-recovery.log）。
- API Nest构建：PASS exit0（api-build.log）。
- meeting-ending.real.spec.cjs首次FAIL，清理503掩盖原始异常；测试已修复保留原异常。
- 该用例复跑FAIL exit1：真实Cloud createRoom的fetch报TLS连接建立前断开；尚未写入测试的ENDING fixture，因此后台恢复验收NOT_RUN。清理end503留下待确认会议，服务日志list-participants/revoke-participants失败，不能称总专项完成。
- 两个测试脚本语法检查及git diff --check PASS exit0。
- 官方用量最后成功读取剩余89%；后续读取不可用，不把不可用解释为充足。
- R4调度实际删除，deleteStatus=deleted；不新增后续自动任务，用户继续指令仍有效，当前chat保留。

本轮没有新增原创3D、捏脸或供应商模型生成；20款仍静态。语音沿用R3真实供应商证据，本轮未重复收费测试。Cloud房间/待确认会议与自有进程最终清理结果待下面条目确认，未确认即UNKNOWN，不写成PASS。

## 收尾追加确认

实际只读核查`recovery-audit.cjs` PASS exit0：上述两场R4 pending end会议后来均为ENDED，每场存在actor=null、after.source=server-monitor的meeting:ended记录。这是失败清理请求产生的真实ENDING意图被后台恢复，不是该fixture浏览器用例整体通过；保留两次用例FAIL及TLS原因。恢复实际生效有数据库审计证据。

最终限定合成组织/项目/标题前缀核查22场会议，pending=0，成员ACTIVE。独立Cloud listRooms因TLS fetch失败，Cloud最终房间清单UNKNOWN，未伪造0。数据库及原上传/工具/配置保留。

本轮自有PG fast stop实际返回server stopped；自有API/Web/Yjs及local-up按已核对PID/父进程停止。Redis shutdown调用未确认，端口核查另存；不把未确认写PASS。仅移除本轮Next类型缓存路径。当前源码快照含共享前轮内容，不是独立提交，不能盲目覆盖恢复。

最终Node TCP端口核查exit0：14430/14431/14432/15570/6399均closed，自有测试服务已无对应监听。git diff --check exit0。9个相关源码/文档已保存到ignored `.test-runs/rtc-r4/source-snapshot`，tracked-changes.patch包含共享未提交内容，仅供人工恢复比对。未归档当前用户继续使用的chat。

15:35官方5小时额度已用11%，剩余89%，未触发7%阈值。期间一次官方读取不可用，没有把不可用当作额度充足。
