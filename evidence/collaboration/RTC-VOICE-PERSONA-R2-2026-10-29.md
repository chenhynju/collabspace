# R2 实施与验收

runId rtc-r2-20261029-0208；Asia/Shanghai 2026-10-29，chat 01a181d5-06a6-7270-b9a8-68dc954205c2。保留整个既有未提交工作树，不add全部、不部署。官方额度开始剩余53%；阶段采样新5小时窗口剩余100%，未触发<7%。

## 本轮代码

- MeetingDevices本机预览与设备选择、权限错误、轨道释放；MeetingCall启用时沿用所选deviceId。
- 消息commit后metadata-only项目Socket.IO提示，客户端鉴权刷新、重连刷新，保留轮询兜底。
- Cloud旧token重入漏洞复现并修复：持久签发名单、显式未来30秒撤销cutoff、成功撤销后再删除。25位签发上限；自托管暂拒签；旧会议名单缺失不误报结束。
- 用户追加面向海外：新增ElevenLabs ASR/TTS适配，默认scribe_v2/eleven_multilingual_v2；固定端点、multipart WAV识别、PCM封装WAV、错误拒绝且无自动回退。Azure/豆包保留为显式选项；共用体积限制与路由指纹。文档提供ElevenLabs与豆包开通、权限、音色、计费及本地配置。
- 数字人用户最终偏好已登记为精致卡通人形、成年比例；旧几何人和日系技术样例均不是正式美术。未外发素材或开通3D付费服务。

## 实际命令与结果（Node22绝对路径运行）

| 检查 | 结果 | 证据边界 |
|---|---|---|
| --test apps/api/tests/speech-alternative.test.cjs | 8/8 PASS exit0 | 模拟供应商协议；ElevenLabs/豆包真实效果NOT_RUN |
| --test apps/api/tests/meetings.test.cjs | 3/3 PASS exit0 | 输入、签发、撤销顺序及失败关闭；最初mock错用ESM副本失败，改用bare CJS SDK后通过 |
| scripts/test-meetings-local.cjs | PASS exit0，正常关闭PG | 真实PostgreSQL、非owner FORCE RLS、消息commit后提示、签发名单、voice_route迁移、结束重试 |
| Playwright meetings.fixture.spec.cjs | 2/2 PASS exit0（29.8秒） | 真实浏览器/合成设备，API fixture；权限拒绝/预览/停止/SPA卸载释放 |
| API/Web tsc --noEmit | PASS exit0 | 源码类型检查 |
| scripts/test-meetings-live.cjs 修复前 | FAIL exit1 | 真实Cloud旧token可重入，房间清理成功 |
| scripts/test-meetings-live.cjs 修复后 | PASS exit0 | 双端合成音视频、实际接收字节、共享解码/停止、结束断开；fresh旧token 3.294秒后服务端401拒绝 |

媒体脱敏每轮JSON保留于.test-runs/rtc-live；未记录token、Key、Secret或供应商URL。未用用户真实麦克风/摄像头/桌面。测试房间清理完成。

## 尚缺，不能标为M3总完成

真实应用HTTP全流程与JWT/Org guard集成、成员在会中撤权与媒体侧踢出、长会话刷新令牌/重连、系统共享选择器和真实硬件、容量/时钟偏差；真实中英文ASR/TTS与可听效果；精致成人卡通定制模型、捏脸/口型、真人分身资格/授权/效果。不存在生产部署或正式上线验收。

下一轮优先：补应用HTTP与会中撤权；使用用户实际海外语音配置做真实短样本；先完成符合确认风格的角色美术与可动资产，不把通用模型当原创交付。

调度：R2执行一次后删除自身任务；R3/R4仍指向当前chat，故保留chat，ARCHIVE_BLOCKED（归档会影响后续上下文依赖）。锁在收尾时释放；不取消其他任务。


## 用户新增海外配置后的真实语音验证（03:31 Asia/Shanghai）

仅检查必要字段状态；ElevenLabs API Key已填、model IDs有效，两个voice字段还是非ASCII占位。第一次测试在本地ready校验退出1，未调用收费语音接口。只读获取默认预置音色列表HTTP200，共21个；仅填补两处无效voice占位为账户列表中的Sarah（预置），其他配置逐键比对保持一致，未输出任何秘密。

`node22 scripts/test-speech-live.cjs`正常exit0，严格4次请求无重试：中文TTS 2.6935秒/86236字节、英文TTS 1.9969375秒/63946字节；16kHz单声道16位WAV校验通过；分别用该合成语音做真实ASR，得到“你好，今天我们一起完成项目”和“Hello, we can work together today”，包含预期词，全部PASS。没有提交个人录音，未开通/购买新资源。

范围是实际海外供应商的TTS→ASR合成短样本闭环，不是自然说话、口音/噪声/多人会议准确率，不是完整应用鉴权链路。音频/脱敏JSON在ignored .test-runs/speech-live，Key仍只在ignored私密文件。主观音质需用户试听，真实麦克风及中英文完整产品流程仍待验收。

`node22 scripts/test-speech-playback.cjs` exit0：真实Edge对两段供应商WAV解码、播放进度、暂停和重播均PASS；复用现有音频，无新增供应商请求。非主观听感或完整产品页面验收。git diff --check exit0。
