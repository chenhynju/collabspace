# 20款可动数字人制作入口

## 2026-10-29 共同配置决定

后续用户已选择`tripo3d`并填写API Key/Client ID，确认USD20总预算；预算已写入本地，其他值未改。上传/启用仍false、最终格式待定。已交付[三款可审阅试制草案](TRIPO-PILOT-PLAN.md)与只读检查/本地计划脚本；鉴权被本机DNS/连接失败阻断，无收费任务。下表保留最初占位含义，当前决定以本段及草案为准。

用户已选“海外服务试制知夏、知行、明悦”，供应商、预算和最终格式仍待共同确定。本机ignored `.test-runs/private/third-party.env`已追加3D规划占位，现有字段逐项保持；公共模板见[环境模板](templates/third-party.env.example)。

| 字段 | 当前含义 |
|---|---|
| `AVATAR_3D_ROUTE=overseas-service` | 已确定海外服务路线 |
| `AVATAR_3D_PILOT_NAMES=知夏,知行,明悦` | 已确定三款试制顺序 |
| `AVATAR_3D_STYLE=refined-cartoon-adult` | 已确定精致卡通、成年比例 |
| `AVATAR_3D_PROVIDER=` | 空，供应商共同确定后填写 |
| `AVATAR_3D_TARGET_FORMAT=` | 空，待结合生成结果及现有VRM播放器确定 |
| `AVATAR_3D_TRIAL_BUDGET_USD=` | 空，尚未授权费用；USD只是拟用预算单位，确认时可修订 |
| `AVATAR_3D_ENABLED=false` / `AVATAR_3D_UPLOAD_APPROVED=false` | 保持未启用、未授权上传 |
| `MESHY_API_KEY=` / `TRIPO_API_KEY=` | 候选Key占位，当前为空，选定后仅填写采用的一家 |

这些新增变量目前是**规划占位**，尚无生成适配器读取，填Key不会自动生成或扣费。下一步共同确定供应商、可接受的样例质量/面部绑定、预算上限和指定素材上传范围，再实现受限试制。捏脸仍以真实有效面部变形为前提。

2026-10-29用户确认：20张图各自对应可动三维角色，精致卡通/成年比例，能随声音对口型；捏脸以确实可行且有效为前提。先验收知夏、知行、明悦，再扩展20款，不以同一个模型换名交付。

## 已做与缺口

- [20款源图制作清单](assets/avatar-20-production-manifest.json)包含实际源文件SHA256、优先级和状态。全部为SOURCE_READY，当前原创定制可动模型数量仍为0；`node22 scripts/prepare-avatar-build-manifest.cjs`可复核，不覆盖已有制作状态。
- 已有中英文ElevenLabs音频经过真实本地Rhubarb分析，生成时间轨道，复用音频不再合成。后台派生接口、VRM播放、暂停/重播/离开清理、跨账号拒绝已实际验证。这是基础音素口型，未量化音素准确率，不等于逐字精确标注。[工具官方说明](https://github.com/DanielSWolf/rhubarb-lip-sync)。
- [带声音的技术演示](../../evidence/collaboration/avatar-mouth-r3.webm)：第三方VRM样例©2022 pixiv Inc.，并非20款定制角色。
- 预览使用授权pixiv VRM样例，只证明动作/口型链路，不能当作20款对应成品。本机没有Blender，Meshy/Tripo/Hyper3D Key均未配置，也没有与20图对应的网格、面部变形和人工美术验收。
- 身体自动绑骨不能推定已有面部口型和捏脸；所核对的[Meshy绑骨](https://docs.meshy.ai/en/api/rigging)与[Tripo绑骨](https://developers.tripo3d.com/en/models/rig)接口确认的是身体骨架/权重。填Key不意味着完整数字人自动完成。

## 每款验收

1. 正面/侧面/背面、发型/肤色/服装符合原画与成年比例；原图未提供的背面和下半身属于补充设计，需要确认。
2. 有humanoid骨架/蒙皮，待机、走路、挥手、转身无明显穿模或关节塌陷；性能和手机显示验收。
3. 真实有效的blink、aa/ih/ou/ee/oh面部变形；闭口、张口、圆唇和音轨时序、暂停、停止、seek、切项目/账号清理均通过。
4. 捏脸只对提供有效脸宽/眼距/鼻宽/下颌等变形和安全范围的模型开放；保存模型版本和参数，刷新效果一致。不显示无效果滑块。
5. 许可证、源图/模型哈希、模型版本及人工外观确认留档，再把实际模型纳入角色目录；目前目录仍保持静态状态。

## 无需新Key的本地口型配置

后端本地环境（不放NEXT_PUBLIC，不自动生产发布）：

```dotenv
SPEECH_PROVIDER=elevenlabs
SPEECH_LIP_SYNC_PROVIDER=rhubarb
RHUBARB_BIN=D:\appspace\collaboration\.test-runs\tools\rhubarb\extracted\Rhubarb-Lip-Sync-1.14.0-Windows\rhubarb.exe
```

官方Windows1.14.0已下载到本工作区ignored目录，ZIP 87,374,842字节、解压163,088,370字节，合计约239MiB。[发布源](https://github.com/DanielSWolf/rhubarb-lip-sync/releases/tag/v1.14.0)，本地哈希见`.test-runs/tools/rhubarb/download.json`；旧发行没有发布者digest，本地哈希不冒充签名。Linux部署须另取相应平台版本并验证，不能使用Windows路径。

新TTS尝试离线口型，失败仍保留成功音频并提示。`POST /voice/jobs/:id/mouth-track`可复用本人已有TTS，重复请求用已存轨道；当前组织/项目/会话重新鉴权，其他人404。单段<=60秒，每进程最多2个分析，取消/超时有界；临时音频分析后删除，不外发，结果不包含路径。

在`/personas/studio`选项目与本人已有朗读，点“分析口型并播放”；暂停/重播/离开清理。此预览不新增ElevenLabs请求。样例模型©2022 pixiv Inc.，许可见仓库模型元数据与预览页，不是原创20款交付。

## 候选建模服务、费用与本地Key

先确认模型来源和试制预算，**不要只为这份指南立即买套餐**。可以用已有授权模型，也可以先网页少量试样后再决定API。

如选择海外Meshy：

1. 在[官网](https://www.meshy.ai/)注册，进入Workspace的Image to3D。网页免费额度/绑骨与API资格、收费不同；先看角色质量，不批量20张。
2. [官方API说明](https://www.meshy.ai/api)要求Pro或以上。决定采用后，由你在官方Billing核对月/年付、币种、税费、额度并付款；本轮不代开通、不启用自动充值。
3. 登录API页面创建专用开发Key，放到本地`.test-runs/private/third-party.env`的`MESHY_API_KEY=`，不发聊天、不放前端、不提交Git。目前没有生成调用适配器，也不会因为填Key就自动上传扣费；先确认路线，再完成适配器和受限试制。
4. 现核对的[API计费表](https://help.meshy.ai/en/articles/16815622-how-many-credits-does-each-meshy-api-task-cost)：Meshy-6带2K/4K贴图单图生成30credits，API身体绑骨5credits。三款各一次=105credits，20款各一次=700credits；**不含**重做、动作、面部绑定、捏脸或人工美术，不能当完整成品报价，提交前重核价格。
5. 外发前须明确仅上传知夏/知行/明悦三张原创图、海外服务及费用上限。当前接力指令限制“不外发素材、不付费开通”，本轮没有上传图片或创建付费资源。没有预算也可以先验收本地嘴型，继续无外发的软件工作。

这是可审阅的制作范围和配置方法，不是20个模型已生成或面部质量达标的声明。
