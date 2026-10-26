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
