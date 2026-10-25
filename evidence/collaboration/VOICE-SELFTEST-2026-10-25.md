# 语音与形象逐项自测

范围：P-VP01–08当前实际实现。线上版本前端dpl_3Ab9wM6uNvN9G79qA6m85xnmDfSv、API r20261025-04；初次代码归档6ece7c1。后续补充仅修改测试、测试启动器和证据，不改变生产功能。

## PASSED

| 功能/边界 | 实际验证 | 证据入口 |
| --- | --- | --- |
| 音频输入真实性 | 真实RIFF/16kHz/单声道/16位PCM；60秒接受，61秒、伪造、截断、立体声和伪造长度拒绝 | apps/api/tests/voice.test.cjs |
| 供应商安全降级 | 无配置503且不调用；SSML转义；503不重试；取消信号传播；NoMatch、空转写、非RIFF输出拒绝 | 同上，模拟fetch，不能证明Azure真实质量 |
| Agent状态真实性 | 完成必须运行时结果；乱序/重复忽略；终态不复活；新run可启动；UI伪造authority拒绝 | apps/api/tests/voice.test.cjs、apps/web/tests/persona.test.cjs |
| 持久任务闭环 | 实际PG中STT文字/TTS音频替身结果、查询和历史；同编号重放不再次调用，变更内容409 | scripts/test-voice-local.cjs |
| 数据库双重隔离 | 非owner、无BYPASSRLS角色直接查询跨组织/跨actor结果为空；服务查询也拒绝 | 同上 |
| 资源授权 | 伪造项目拒绝；处理中成员暂停，后续查询拒绝，结果文字和音频不保存 | 同上 |
| 取消与隐私 | RUNNING取消后CANCELLED，输入和输出媒体/文字清除，迟到结果不能覆盖 | 同上 |
| 并发与请求额度 | 同actor已有运行任务时第二请求429，不调用供应商；每小时20条任务后429 | 同上，合成额度数据测试后删除 |
| 跨实例恢复 | QUEUED行由两个新服务实例同时查询恢复，数据库原子claim使供应商仅调用一次 | 同上；不是Redis多worker成绩 |
| 不确定结果 | 供应商失败变UNKNOWN；相同编号不重试；超过2分钟RUNNING查询变UNKNOWN且不调用供应商 | 同上 |
| 过期与清理 | 已过期任务读取404、历史不可见；本人下一次创建任务物理删除过期行 | 同上；不证明无人访问时定时清理 |
| 审计脱敏 | 实际审计有任务创建记录，正文/转写不进入审计结果 | 同上 |
| IM正式原音闭环 | 真录制流程使用假麦克风，转换PCM、附可编辑文字发送；第二账号读取、鉴权下载及播放控件；重放同消息；跨组织拒绝 | tests/browser/voice-persona-online.spec.cjs，1/1通过 |
| 形象正式展示 | 3D画布、讲话动作启停、偏好持久化刷新、测试后恢复原值 | 同上 |
| 邮件外发边界 | 选择项目后保留邮件模式、可编辑草稿进入确认预览；POST计数0并额外拦截发信 | 同上，未点击确认 |
| 正式API回归 | 鉴权能力状态、human身份、未配置TTS503、伪造组织403、真实Linux DOCX合成文件提取 | scripts/verify-voice-online.cjs、voice-online-api.json |
| 构建与既有回归 | API/Web构建通过；Web19/19；API串行39通过、6跳过、0失败；Store脚本通过含可选跳过 | VOICE-RELEASE-2026-10-25.md |
| 发布资源与健康 | DB/Redis up、Office true、OOM false、restart0；API约71MiB/384MiB，磁盘9GiB，可用内存1723MiB | 同上，部署窗口抽样 |

新增适配器断言与前端事件协议联合单测4/4通过。扩展隔离PG脚本实际通过，最新一轮退出码0，包含跨实例claim与直接actor RLS断言。测试库为新建`.test-runs/voice-persona-final`，127.0.0.1:15449，不使用生产数据。实际命令：

```powershell
node --test apps/api/tests/voice.test.cjs apps/web/tests/persona.test.cjs
$env:VOICE_LOCAL_CONFIG='.test-runs/voice-persona-final/config.json'
node scripts/test-voice-local.cjs
```

本地浏览器最终整组**3/3通过，4.1分钟**：真实录音与双账号原音收发、明确标识的STT/TTS替身修订/播放停止/旧音频失效、麦克风拒绝与邮件不外发。目录`.test-runs/voice-persona-browser-final/.last-run.json`为passed、failedTests为空。

补充HTTP与浏览器边界**2/2通过，32.7秒**，脚本`tests/browser/voice-boundaries.spec.cjs`，结果目录`.test-runs/voice-boundaries-final`：

- 未登录401、无组织400、伪造组织403；非法UUID/语言/kind、空文字、4001字、无scope、双scope均400，外国项目404，合法输入但供应商未配503。
- 伪造audio/wav拒绝；不存在/畸形任务的查询、下载和取消均404。
- 非法形象/语言拒绝；请求体伪造identity、actorId和organizationId不能改变当前human身份或操作他人形象，测试后恢复偏好。
- 录音中取消不生成试听且麦克风轨道全部ended；结束录音后丢弃移除试听；消息、上传和语音任务POST计数0。
- 本地超过10MiB的VRM拒绝且无上传。有效VRM加载仍未验收。

以上测试统一使用`COLLAB_BROWSER_CONFIG=.test-runs/voice-persona-final/config.json`，在沙箱外运行Edge以避开已确认的启动限制。

## BLOCKED

- Azure未配置：真实STT/TTS、中文/英文/混说效果、供应商网络与费用、真实音频嘴型同步不能验收。替身仅验证编排和安全边界。
- 真人供应商未选定/配置：真人视频生成、授权形象、邮件视频链接未完成。
- 真实Agent/Skill运行时尚未接入：当前仅组件和事件协议，不能声明工具执行成功。

## NOT_RUN

- 精确viseme、授权VRM实物资产和跨设备保存、移动端/Safari/Firefox兼容、持续负载/内存泄漏与长时间容量测试。
- BullMQ开启后的Redis故障、多worker进程崩溃、真实进程强杀恢复；当前仅默认单进程及新实例DB claim验证。
- 真实邮件外发、模型生成、付费语音、货币金额硬上限、无人访问时定时物理清理、备份过期删除与整库恢复演练。
- API全套中6项依赖独立PG/Redis等可选集成被跳过，不计为通过。语音隔离PG脚本单独实际执行，不能替代其他模块集成。

## 测试中暴露的问题

- Windows并行测试曾出现DOCX和seed子进程超时，串行全套通过，未放宽生产超时。
- 沙箱拒绝本地数据库连接和Edge启动；直连正式API出现超时/ECONNRESET。外部环境及显式既有本机代理后正式验证通过，不修改生产网络策略。
- 重用本地测试库时Prisma db push试图删除SQL管理的voice表，数据保护拒绝，未执行删除。local-up增加仅允许已seed隔离库的COLLAB_LOCAL_SKIP_SCHEMA_PUSH开关；新库仍正常db push后应用SQL迁移。
- 本地环境无Redis6399，既有invitation_delivery初始化缺失，调度器有报错；不计为Redis/邀请功能通过，也不以生产数据库修复本地环境。

重复启动修复实测通过：正常关闭并重新启动15449测试库，设置COLLAB_LOCAL_SKIP_SCHEMA_PUSH=1后不运行Prisma db push，继续应用RLS/增量迁移并启动服务；重启后voice_job仍有14条、persona_profile仍有1条。未seed目录启用该选项会在数据库启动前拒绝，独立进程断言通过。

测试目标保护补测通过：即使DATABASE_URL为本机测试库，DATABASE_ADMIN_URL指向其他主机也会在连接/迁移前拒绝。两者必须为同一127.0.0.1、15439或15449端口的collabspace库。追加浏览器边界脚本也同时限制Web和API为本机。完整前端122文件再次与正式部署源清单逐项匹配；没有为测试结果重复发布相同应用代码。补测后已正常关闭本轮测试数据库及其API/Web/WS进程，保留数据目录。

结论：原音通信、个人卡通预览和已列安全边界具备实际验证；完整STT/TTS、真人数字人和Agent运行时仍未达到完整产品验收，保持不可用或明确标识。
