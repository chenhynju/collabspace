# 语音与形象：本地运行和配置

当前实现融入IM与协作助手/邮件草稿，不另建应用。2026-10-25已按用户明确授权更新现有正式站点，资源与正式验收见[上线报告](../../evidence/collaboration/VOICE-RELEASE-2026-10-25.md)。范围与验收编号见VOICE-PERSONA.md；本地成绩见evidence/collaboration/VOICE-PERSONA-2026-10-25.md。云语音/真人服务仍未配置。

## 配置（仅示例，无凭据）

```dotenv
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
# 未开启时为单API进程即时执行+数据库持久任务；刷新查询恢复QUEUED。
# 启用后由BullMQ消费，Redis只传组织、actor和任务ID，不传音频/正文。
VOICE_QUEUE_ENABLED=false
REDIS_URL=redis://127.0.0.1:6379
```

无Azure配置时录音/试听/原音发送仍可用，云转写与合成明确禁用；系统朗读作为独立降级，不承诺可导出音频或精确嘴型。中文/英文为显式选项，混合语言质量未实测。REST首版只返回最终转写，未实现流式识别和精确viseme；卡通云音频通过本地音量分析近似开合嘴。

## 本地合成环境

```powershell
$env:COLLAB_LOCAL_NAME='voice-persona'
$env:COLLAB_LOCAL_DB_PORT='15439'
$env:COLLAB_LOCAL_WEB_PORT='14320'
$env:COLLAB_LOCAL_API_PORT='14321'
$env:COLLAB_LOCAL_WS_PORT='14322'
$env:COLLAB_LOCAL_SKIP_GENERATE='1'
$env:AZURE_SPEECH_KEY=''
$env:AZURE_SPEECH_REGION=''
$env:DEEPSEEK_API_KEY=''
node scripts/local-up.cjs
```

local-up创建独立测试数据库并只对它执行迁移/seed。不得把生产DATABASE_URL替换进此流程。首次需现有Prisma客户端；没有生成产物时先用仓库db:generate脚本。测试角色为非owner的teamspace_app。

```powershell
pnpm --filter @teamspace/api run build
node --test apps/api/tests/voice.test.cjs
node --test apps/web/tests/persona.test.cjs
node scripts/test-voice-local.cjs
$env:COLLAB_BROWSER_CONFIG='.test-runs/voice-persona/config.json'
node node_modules/@playwright/test/cli.js test tests/browser/voice-persona.spec.cjs --config playwright.config.cjs --reporter=list --output=.test-runs/voice-persona-browser
```

## 数据、状态与接口

- `/voice/status`只返回功能开关，不返回密钥。
- POST `/voice/jobs`接受JSON TTS或multipart PCM WAV STT，requestId必须UUIDv4，scope为一个projectId或conversationId。
- GET `/voice/jobs`按scope返回本人最近10条任务；GET `/voice/jobs/:id`查询并恢复排队任务；GET `/voice/jobs/:id/audio`鉴权获取合成音频；DELETE取消并清理该任务正文/媒体。
- GET/PUT `/voice/persona`仅保存当前组织本人的外观/语言偏好，不能更改身份或权限。尚未公开为组织共享人物目录。
- `QUEUED → RUNNING → SUCCEEDED / UNKNOWN`，取消为`CANCELLED`；DB原子claim保证重复队列投递不重复执行。异常不自动重新收费；同编号同内容回读，不同内容拒绝。超过两分钟的RUNNING由查询转UNKNOWN，不能假定供应商未收费。
- 每组织用户每小时20次、同时1个任务；STT真实PCM最长60秒，TTS最长4000字。属于请求/输入上限，不是货币金额硬预算。
- 语音消息复用现有FILE消息/MessageAttachment，不新增平行消息表。WAV容器/参数/实际时长在上传端校验；发送时校验附件属于当前组织、会话和上传者。requestId支持消息重放去重。

临时音频与转写存入受组织+actor双重RLS保护的voice_job，24小时后接口拒绝访问；在本人后续创建任务时清理过期记录。**未实现无人访问时的定时物理清理及备份过期清理**，这是生产门禁。已发送原音沿用私有附件存储与现有IM保留策略。尚未迁入S3；当前小体积本地闭环选择复用数据库和私有附件，以减少双写和孤儿文件。

BullMQ可选开启，任务队列初次入队与DB提交不是分布式事务：入队失败保留QUEUED，授权查询会重新入队。未运行Redis断电/多worker/重启全套验收前，不宣称无人值守队列可靠性通过。

## 数字人及Agent边界

内置卡通为原创几何3D人物；three-vrm已集成，可本地预览有使用权的VRM文件，模型不上传、不跨设备保存。未内置第三方授权VRM资产包。真人外观可保存偏好，但供应商未选定，没有真人生成按钮或虚构视频；AvatarProvider契约要求绑定授权音频/形象版本，当前实现明确返回未配置。

AgentPersona组件与版本1事件契约处理序号去重、终态和结果引用；没有把浏览器事件接入真实Agent工具执行。Skill展示为调用者的能力。停止语音只作用于语音任务与播放，不取消业务Agent任务。后续运行时适配必须在服务端验证事件来源与结果归属，客户端的authority字段本身不是认证凭据。

邮件仍使用原有确认发送，口述只写可编辑草稿；未实现向外部收件人公开视频、视频署名或邮件内动态3D。真人音视频、真实供应商中英效果、多人/多设备浏览器兼容、精确嘴型、严格货币预算和生产发布均需独立验收。
