# 语音与数字形象：本地交付与验收

这是首次本地执行的历史快照。最终整组浏览器3/3、边界2/2、扩展PG和回归结果见[详细自测](VOICE-SELFTEST-2026-10-25.md)；后续正式发布见[上线记录](VOICE-RELEASE-2026-10-25.md)。下文当时的未提交、未部署和未重跑状态不代表最终状态。

日期：2026-10-25；北京时间14:30一次性任务触发。基线HEAD：766cf4fc6ad82781f3ca8106d4bc9bac988a969e，交付为其上的未提交工作树，未推送/部署。开始时仅已有README、需求/设计/执行入口的规划改动及未跟踪VOICE-PERSONA.md，均保留。没有修改源工程、真实发信或开通付费资源。

## 实际实现

- 独立voice/personas组件融入IM和协作助手，不新建消息/组织/权限系统。
- MediaRecorder本地录音/试听/取消，浏览器转换16kHz单声道16位PCM，服务端解析实际RIFF容器和时长；原音与可编辑文字复用现有FILE消息。附件发送校验组织、会话、上传者；UUID消息编号重放去重；跨会话/组织切换阻止旧响应写入当前消息列表。
- Azure STT/TTS REST适配，密钥只在服务端；显式中/英文、XML转义、输入/响应限长、90秒超时、失败UNKNOWN且不自动付费重试。云语音未配置时UI禁用，系统朗读明确降级。
- PostgreSQL持久任务、组织+actor双RLS、幂等/预算/取消/历史恢复/脱敏审计。BullMQ为可选后台执行，默认单进程DB claim即时执行；回读QUEUED恢复调度。
- 组织内个人形象/语言偏好持久化；原创几何3D人物与本地VRM预览；云音频音量驱动近似开合嘴。真人服务未配置，明确不可用。
- AgentPersona与版本1事件契约：序号去重、终态不复活、完成需要结果引用、Skill展示调用者。尚未连接真实Agent工具执行。
- 邮件口述只进入草稿，复用原有预览确认发送；修复选择项目会因父组件key重挂载而丢失邮件模式的问题。

## 环境与证据

Windows，Node v22.20.0 / pnpm 12.4.2，Edge Playwright 1.56.1。独立合成PG18数据库`.test-runs/voice-persona/pgdata`，最终数据库端口15439、Web14320、API14321、正文WS14322。应用连接使用非owner、无BYPASSRLS的teamspace_app。云语音/DeepSeek密钥显式置空、邮件console；STT/TTS成功测试均明确使用替身，不是真实供应商成绩。

| 检查 | 已观察结果 |
| --- | --- |
| `pnpm --filter @teamspace/api run build` | PASSED；最终包含真人未配置适配器的源代码再次编译退出码0 |
| `$env:NEXT_DIST_DIR='.next-voice-check'; pnpm --filter @teamspace/web run build` | PASSED，38个页面生成；后续UI修正使用独立tsc复核，不把旧构建当最终全部浏览器验收 |
| `node --test apps/api/tests/voice.test.cjs` | PASSED 3/3：真实WAV边界/伪造拒绝、完成结果约束、Azure适配替身/未配置拒绝/SSML转义/不自动重试 |
| `node --test apps/web/tests/persona.test.cjs` | PASSED 1/1：事件乱序、重复、终态与结果引用 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false`（apps/web） | PASSED，最终前端源代码类型检查，包含邮件模式保留、形象异步加载保护及IM切组织响应保护 |
| `node scripts/test-voice-local.cjs` | PASSED：实际隔离PG持久任务、STT/TTS替身、幂等/冲突、跨组织和跨actor RLS、无权scope、取消、UNKNOWN不重试、恢复/历史、处理中暂停成员后不返回/保存结果、脱敏审计 |
| 浏览器：实际本地IM录音 | PASSED单独复核及后续完整运行的首项：模拟麦克风录制、真实本地PCM上传、附文字发送、消息重放去重、第二账号读取/鉴权播放、跨组织拒绝、形象偏好刷新保留、3D画布和云语音未配置禁用 |
| 浏览器：明确标注STT/TTS UI替身 | PASSED：转写进入可编辑正文、生成语音、停止播报、修改文字中止旧音频播放。仅前端编排证明 |
| 浏览器：邮件/麦克风拒绝 | PASSED单独复核及后续完整运行：拒绝麦克风错误可见、草稿可编辑、未配置真实邮件禁用发送，实际邮件POST计数0 |

浏览器命令：设置`COLLAB_BROWSER_CONFIG=.test-runs/voice-persona/config.json`，执行`node node_modules/@playwright/test/cli.js test tests/browser/voice-persona.spec.cjs --config playwright.config.cjs --reporter=list --output=.test-runs/voice-persona-browser-verified`。初次API未就绪导致连接拒绝；发现并修复邮件模式重置；重复运行显式选择卡通，避免把前一次保存的真人偏好当错误。每条浏览器路径均有实际通过记录；最后合并重跑遇到工具会话刷新，未收到整组最终退出码，因此不写最终整组3/3。

截图（已目视检查）：[卡通预览](voice-persona-cartoon.png)、[IM语音](voice-persona-im.png)、[邮件语音](voice-persona-mail.png)。截图仅辅助，不替代上述数据库与权限检查。

## 回归失败及阻塞

- **FAILED**：既有`apps/api/tests/assistant.test.cjs`的DOCX解析检查在原10秒子进程时限下超时；单独复核仍失败。PDF解析在允许子进程的环境复核通过，其余4项助手检查通过。未修改解析器或放宽超时，不能宣称助手全量回归通过。
- **BLOCKED**：缺少Azure语音配置，真实识别、真实合成、中英混说质量/地区网络/费用未验收；不能把替身结果当识别效果。
- **BLOCKED**：真人供应商尚未选定/配置，只有明确未配置的适配契约与偏好入口；真人视频生成、授权形象、邮件视频链接/署名没有完成。
- **NOT_RUN**：完整Agent运行时、授权VRM资产跨设备保存/共享、精确viseme、真实邮件投递、生产部署、Redis故障/多worker/重启全套测试、移动端/多浏览器兼容、严格货币预算。
- **NOT_RUN**：临时数据无人访问时的定时物理清理与备份过期清理。当前24小时后接口拒绝访问，后续本人创建时物理清理；上线前必须完善。
- **NOT_RUN**：工具会话刷新后，本地进程已结束；最后追加的conversation复合外键尚未重跑整套迁移测试，脚本已加入仅对15439隔离库执行最新voice.sql的步骤。已有组织/actor RLS与撤权成绩来自刷新前实际运行。
- 本地启动器还报告既有`invitation_delivery`表未纳入其初始化的调度错误；不属于本次voice表，未用生产迁移修复，也不计语音功能通过。

## AT逐项结论

AT-VP01部分通过（个人偏好/身份与外观分离），组织共享人物目录未做；AT-VP02原音闭环通过、真实STT阻塞；AT-VP03前端/适配替身通过、真实TTS及精确嘴型未验；AT-VP04草稿与不外发通过，真实语音服务阻塞；AT-VP05卡通预览通过，真人生成与邮件视频未完成；AT-VP06协议组件通过，真实运行时未接；AT-VP07隔离/撤权本地通过，生产存储与保留门禁未过；AT-VP08DB幂等/取消/恢复通过，后台队列故障与货币预算未验。**不宣称全部8项完成。**

## 运行与回退

按[运行说明](../../docs/collaboration/VOICE-PERSONA-OPERATIONS.md)启动隔离环境。迁移`packages/collab-store/voice.sql`已接入现有collab:migrate；只能在核对目标库后执行，生产未应用。回退应用时移除VoiceModule及UI入口即可停用新增能力，保留新增表便于审计；不提供自动删表或清除现有消息的回退。当前交付仅本地源码与证据。
