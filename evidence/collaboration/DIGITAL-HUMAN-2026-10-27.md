# 数字人第一阶段本地实现与验收

2026-10-27。基线9a09cad；用户批准详细设计后要求实施，随后确认小岚方向，追加后台配置、固定形象/捏脸、男10女10目标及真人高相似度要求。**这是第一阶段，完整数字人功能未完成，未更新线上站点。**

## 已实现

- 原创小岚静态角色稿，内置imagegen生成，项目文件apps/web/public/personas/agent-lan-v1.png，完整prompt及表示类型见同目录README.md。只作为静态头像/建模参考；不是VRM或已交付动画。
- 移除默认几何球体和正弦假讲话。Agent卡片默认小头像、按需展开240px舞台，保持真实运行事件与任务完成判定。可加载真实VRM时以播放时钟和轨道驱动基础口型，具备低频眨眼/视线与减少动态支持；无正式VRM时明确显示静态稿。
- 参数管理增加组织内协作助手形象配置入口，服务端config:edit权限、版本冲突检查、审计与组织RLS；当前唯一可选资产是小岚静态稿。服务明确返回20款和捏脸仍为规划，不提供假选项。不宣称已有通用多Agent后台配置或20个可动模型。
- “我的数字分身”改为真人照片/视频素材入口，支持本地原素材预览、明确本人私有草稿授权、实际类型初筛、上传/列表/重开预览、撤销并清除原素材。照片与视频均有实际本地路径，但都不是供应商创建或训练路径。
- 私有素材草稿保存在隔离数据库bytea，20MB/件、每人最多3份有效草稿、7天访问有效期；RLS组织+本人、服务端成员检查、UUID/内容哈希幂等、撤销原字节、脱敏审计。此为受限本地实现，未接生产对象存储、病毒/人脸/完整媒体解码检查或后台定时物理清理。接口标注CONTAINER_ONLY，不冒充训练素材合格。
- Azure SDK 1.53.0适配：同一次TTS得到音轨及viseme offset，单位归一化、轨道限制、Abort/close、错误保留未知结果；voice_job新增result_visemes，复用现有任务/私有音轨权限。默认AZURE_VISEME_ENABLED未开启，真实账号/地区/音色未测试。JavaScript SDK契约fixture不是云调用成绩。
- 播放订阅按组织/用户/项目/Agent隔离；替换新舞台的全局音量监听，旧release不能停新会话。停止/暂停根据真实audio时钟归零基础口型，不以嘴动写任务完成。

## PASSED

- Web单测25/25（新增播放作用域、旧会话释放、时序口型/静音/闭唇/停止/seek）；TypeScript noEmit退出0。
- API类型构建通过；数字人/语音定向6/6。包括实际素材类型/尺寸/授权拒绝、SDK合成契约（fixture）、音轨/offset绑定、停止释放、原Azure地区路由和WAV安全。
- API全量串行47通过、6跳过，无失败；.test-runs/digital-human-api-all-serial.log。首次默认并行46通过/1失败/6跳过，DOCX解析子进程超过已有10秒上限；单项复核通过（9.32秒），串行复跑通过。未修改生产超时；在本机高负载并行解析存在时限风险，不能把串行结果说成负载验收通过。
- 隔离库迁移成功，未使用生产DATABASE_URL。实际应用角色SQL证明本人可见、同组织另一人/跨组织不可见；撤销后原素材列为空。.test-runs/digital-human-rls.cjs。
- 新功能本地Playwright 3/3：实际API授权/幂等/跨组织/撤销/未配置503，真实浏览器照片/WebM素材保存重开撤销，后台配置保存和舞台展开收起。.test-runs/digital-human-local-browser-final/.last-run.json为passed。WebM来自浏览器合成色块，不含真人；照片用原创虚拟角色图。未向真人供应商传素材。
- 语音回归已通过项：真实本地IM录音→试听→修订文字→发送→另一账号鉴权播放，偏好持久化、跨组织拒绝；STT/TTS UI fixture的人审/停止/编辑失效。完整运行结束结果见下节。
- 截图digital-human-local-agent.png、digital-human-local-drafts.png已视觉检查。仅本地截图，不冒充上线效果。

## 实际失败与修复

- 初次依赖安装引用旧pnpm入口不存在；使用现有fallback pnpm11.25.0安装锁定SDK1.53.0，6分钟，新增13项传递包；未变更全局Node/nvm，包与锁文件同步。
- 浏览器首轮2/3：脚本按最后一个file input选择误入IM附件入口，已改成精确aria-label，完整3/3复跑通过。误发附件仅在本地合成账号会话，无真实外发邮件。
- 旧语音回归首次失败是提示文字已更新为“个人语言偏好”，已同步断言；原业务断言保留。
- 首次生产构建从根目录传apps/web，Tailwind相对配置警告，因此中止且不计通过；按apps/web工作目录重新运行实际Next build，最终结果待完成记录。没有启动本地生产服务，未绕过历史审批阻塞。
- 既有隔离库仍缺invitation_delivery/invitation_sync_inbox，后台有对应日志；不在本轮改动范围，邀请后台功能不计通过。

## BLOCKED / NOT_RUN / 未完成

| 项目 | 状态与原因 |
| --- | --- |
| 正式可动3D角色、动作/模型资产 | 未完成。只有用户认可方向的静态稿，骨骼/面部绑定/动作需制作与验收；当前没有配套VRM实机证据 |
| 男10款女10款预设、捏脸 | 未完成。已写入需求/后台能力边界，尚无20款资产与捏脸参数渲染器；不能用一图多名冒充 |
| 真人照片生成与视频训练、本人确认后发送 | BLOCKED且实现未完成。当前只有私有素材草稿；真实创建/渲染适配、模型审核发布、受控输出媒体和真人消息确认尚未接入 |
| Azure真实STT/TTS/viseme | BLOCKED。尚无可用凭据，SDK仅fixture验证，不宣称中英文精确音画效果 |
| 真人高度还原、国内/海外供应商实测 | BLOCKED。需服务访问资格、本人授权素材和真实输出；没有凭参考案例证明本产品达到同等效果 |
| 原生Avatar文本驱动与外部音频驱动 | 详细设计已区分，实际真人适配仍是UnconfiguredAvatarProvider；不能说已完成两种协议集成 |
| 生产对象存储/完整媒体检查/病毒扫描/按时物理清理 | NOT_RUN/未实现；过期读拒绝和访问触发清理不等于定时删除 |
| 多Agent配置、邮件中合成视频链接、真人实时会话/额度/供应商删除收据 | 未完成，保留设计门槛，不把草稿/角色卡当闭环 |
| Safari/Firefox/手机/无WebGL真实模型/帧率/显存/真实并发 | NOT_RUN |
| 生产迁移、生产部署、实际域名验收 | NOT_RUN。当前新增数据表和字段仅在隔离库应用，未动线上/API/WS/Office |

## 运行与恢复

本地Node22.20.0绝对路径；COLLAB_BROWSER_CONFIG=.test-runs/voice-persona-final/config.json，Web14320/API14321/WS14322/PG15449/Redis6399，Azure/DeepSeek为空、邮件console。配置文件私有，不提交或打印密钥。

实际命令：`node --test apps/web/tests/*.test.cjs`；`node apps/api/node_modules/typescript/bin/tsc -p apps/api/tsconfig.json`；`node --test --test-concurrency=1 apps/api/tests/*.test.cjs`；Playwright分别运行tests/browser/digital-human.spec.cjs及tests/browser/voice-persona.spec.cjs，输出目录以本报告记录为准。

下一步：先交付小岚正式模型与20款同风格资产/捏脸能力；并取得真人服务能力配置及本人授权样本，再实现照片/视频创建、审核/发布与真实播放。两路线都需完成，不因供应商缺失取消需求。上线前补存储/清理/媒体检查、权限/费用/恢复/相似度证据，不能直接将当前本地草稿方案生产开放。

## 最终补充与归档

- 正确工作目录的生产构建最终退出0，38页、编译及类型检查通过；既有lint警告保留。
- 语音回归最终3/3，2.0分钟；新功能3/3，两份.last-run.json均status=passed/failedTests=[]。其中云STT/TTS界面为显式fixture，不算真实供应商调用。
- 最后一次API构建与数字人/语音定向6/6通过，包含SDK同步抛错的资源释放修正。
- 收尾按归属关闭本次PG/API/Next/WS/Redis；保留数据库与证据，不动另一Redis进程。清除Next自动生成的tsconfig include项。
- 5小时剩余9%触发既有授权条件，已创建北京时间2026-10-28 00:42、05:44各一次接力，id分别collabspace-00-42、collabspace-05-44。详细继续入口：docs/collaboration/DIGITAL-HUMAN-HANDOFF.md。
- 开发归档分支codex/digital-human-20261027，标签collabspace-20261027-digital-human-foundation。当前未合并主分支、未生产迁移或部署；压缩包及SHA256在.test-runs/archives。设计和本地阶段不是完整功能完成。
