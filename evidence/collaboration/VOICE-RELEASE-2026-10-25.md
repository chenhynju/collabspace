# 语音与数字形象正式站点发布

2026-10-25，用户明确授权更新现有站点，并要求关注服务器CPU、内存和磁盘；资源不足时允许迁移到43.130.127.57。本次增量部署余量足够，未迁移项目，未修改其他项目、DNS或Office/正文WS服务。

## 运行身份

- 正式前端：https://collabspace.purelamp.uk 。Vercel项目purelamp/collabspace，部署`dpl_G4xzHfAg49G6mtaBFRvAgfNZJkm6`，候选地址`https://collabspace-7qxhqj2ac-purelamp.vercel.app`。已inspect为Ready并promote成功。
- 原前端回退目标现场确认：`https://collabspace-kau0ekfkf-purelamp.vercel.app`，`dpl_DaWQp85krqjFWTT8aonXjtY1R9fL`。
- API：`collabspace-api:r20261025-04`，镜像`sha256:d171444e1957206219d8a6e34069c8f8c3f437b1e80d5494edcbd5163144b1c4`；原API为r20261025-03，`sha256:67315d7eddf867828496eb205dec2880af7542e8a7507ee371c07ed6f3acd3a8`。
- WS仍为r20261024-02，`sha256:e4862c6eb6ef3e283dee9a85ae287d1c9d6a6dd76221642bc02d0db9a279c307`；无重启，Office引擎保持原实例。
- 源码为基线`766cf4fc6ad82781f3ca8106d4bc9bac988a969e`上的未提交工作树，不冒充已提交Git版本。后端增量文件逐项SHA256清单保存在`.test-runs/deploy/voice-r20261025-04/manifest.json`，17个依赖包、1393个文件、10366192字节；归档2286936字节，SHA256 `50e3c63e958351df4bbe1dae5cc95a7bbeaeeb8553aac77837f586848c936225`，上传后再次核对一致。
- 前端快照122个文件，不含.env、凭据、node_modules和编译目录，清单在`.test-runs/deploy/voice-web-manifest.json`，源清单哈希`815df1b6883a1ea250d917b6c6da1f44878387aec1a5e93e92a36e928e9f93f2`。构建由Vercel执行，未占用应用服务器编译资源。

## 服务器资源与部署方式

现服务器170.106.161.82：2核，3723MiB内存，约59GiB根盘，承载多个项目。所有检查和操作仅针对CollabSpace，不执行共享Docker prune。

| 时点 | 可用内存 | 根盘可用/使用率 | 负载/CPU观察 | API内存 |
| --- | --- | --- | --- | --- |
| 部署前 | 1718MiB | 约9GiB / 85% | load 0.93/0.69/0.63 | 72.71MiB / 384MiB |
| 受限构建后 | 1715MiB | 约9GiB / 85% | load 2.22/1.29/1.03 | 72.36MiB / 384MiB（旧实例） |
| API切换后复核 | 1728MiB | 约9GiB / 85% | load 1.42/1.34/1.11；vmstat短样本idle 73–88%，无持续换入换出 | 67.2MiB / 384MiB |

Swap约820MiB已使用，因此避免服务器编译和新增常驻worker。保留API384MiB内存上限，新增1 CPU上限；VOICE_QUEUE_ENABLED=false，云语音/真人服务未配置。后台队列没有启用。镜像仅在已有Linux基础层增加约17.7MB逻辑大小；服务器离线构建限制256MiB、0.5 CPU，模块烟测192MiB/0.5 CPU。

构建/切换脚本每阶段检查：磁盘可用大于5GB、MemAvailable大于约1GB、load1不超过核数1.5倍。当前满足门槛，未触发迁移条件。上述为部署窗口的抽样，不是长期容量或压测承诺；根盘85%仍需后续容量管理。

## 迁移验证、备份与回退

1. 在无网络、192MiB/0.5 CPU、临时内存数据盘的独立PG16容器验证最新voice.sql：正常写入、跨组织conversation复合外键拒绝、非owner的组织/actor RLS均通过。测试容器已移除，不读取或复制生产业务数据。
2. 新镜像在Linux下加载VoiceModule、IM和AppModule通过，未意外携带语音凭据。
3. 切换前生产数据库dump 54912979字节，SHA256 `15bd0de6008d4acbd5a04af081ccf1065ad6b58fb9ebb12e28b3ea0af8a0d6fe`；附件归档590495字节，SHA256 `f7314092634264b0d2780539a135b0a65361bebb3fbfa758c43689c12474c915`。文件位于`/opt/collabspace/shared/before-r20261025-04.dump`及`uploads-before-r20261025-04.tgz`，配置备份`env-before-r20261025-04`；均为0600。已检查pg_restore catalog，没有演练整库恢复。
4. 事务应用voice.sql，设置3秒锁等待和15秒语句上限，只新增语音/个人形象表、索引、复合外键和RLS授权。未导入/覆盖既有业务数据。
5. 只重建API；ready失败会自动回退原r20261025-03及备份配置。新API已ready，DB/Redis均up，OOMKilled=false、restartCount=0；Office healthcheck=true。
6. 需要回退时使用原前端部署和r20261025-03 API/配置。新增表兼容旧应用，回退保留新增表/数据，不自动删表或用旧备份覆盖新业务。

## 正式域名业务验收

`COLLAB_BROWSER_CONFIG=.test-runs/deploy/online-config.json VOICE_ONLINE_ACCEPTANCE=1 node node_modules/@playwright/test/cli.js test tests/browser/voice-persona-online.spec.cjs --config playwright.config.cjs --reporter=list --output=.test-runs/voice-persona-online`

**PASSED，1/1，执行1.2分钟、总计1.8分钟。** `.test-runs/voice-persona-online/.last-run.json`记录passed、failedTests为空。

- 两个既有合成演示账号真实登录正式站点。
- 3D画布可见、讲话动作预览、个人偏好保存和刷新；测试后恢复原偏好。
- 浏览器假麦克风实际录制、转PCM、附文字发送原音；发送后清除录音草稿。
- 第二账号读取和鉴权加载音频，实际下载内容为16kHz RIFF；伪造组织拒绝；同发送编号重放返回同消息ID。
- 正式API语音能力返回未配置，云朗读和转写按钮禁用，不发生真实语音调用。
- 邮件模式选择项目后保持，草稿可编辑并进入确认预览；未点击确认，邮件POST计数0，并为测试额外拦截任何意外邮件POST。没有真实测试发信。

截图：[正式3D预览](voice-persona-online-cartoon.png)、[接收方原音](voice-persona-online-peer.png)、[邮件确认预览](voice-persona-online-mail-preview.png)。截图是辅助证据，业务判断来自上述断言。

## 未完成边界

真实STT/TTS、中英混说质量、精确嘴型、真人视频、真实Agent工具执行、模型/邮件实际调用、语音预算金额硬上限和无人访问时的定时物理清理均未新增验收。当前云语音/真人能力保持禁用；不是完整数字人产品已完成声明。

初次本地并行测试出现DOCX子进程超时；最终串行运行通过，见下方复核记录。上线增量没有替换既有解析模块。

首次前端普通上传fetch失败，压缩归档上传重试成功；旧站点在候选Ready前未切域名。本机独立Node直连API曾超时，已发现系统配置代理；没有修改服务器防火墙、DNS、证书验证或用户代理设置来绕过问题。

## 用户要求自测后再次发布的最终复核

- API构建通过；Web生产构建通过（存在lint警告，不是零警告声明）。Web单测19/19通过；Store脚本通过，依赖独立数据库的可选项跳过。
- API默认并行测试初次37通过/2失败/6跳过，沙箱外重跑38通过/1失败/6跳过。随后从apps/api运行`node --test --test-concurrency=1 tests/*.test.cjs`：45项，39通过、0失败、6跳过，耗时57.5秒；DOCX、PDF与seed guard均通过。没有放宽生产解析超时。可选PG/Redis集成跳过项不当作通过。
- Next构建首次自定义目录创建被EPERM拒绝；沙箱外标准构建通过。Edge在沙箱中启动即退出；直接外网连接也出现超时/ECONNRESET。此类失败保留记录，不冒充业务断言已执行。
- `scripts/verify-voice-online.cjs`通过显式使用本机既有代理完成正式API验证：登录后语音状态与human身份、未配置TTS返回503、跨组织403、真实Linux DOCX提取合成文件。证据`voice-online-api.json`。无模型、付费语音或真实发信。
- 最终前端候选`https://collabspace-6eea9z4i4-purelamp.vercel.app`，`dpl_3Ab9wM6uNvN9G79qA6m85xnmDfSv`，inspect Ready并promote成功。122文件快照内容哈希仍为`815df1b6883a1ea250d917b6c6da1f44878387aec1a5e93e92a36e928e9f93f2`，与上次发布相同；快照`.test-runs/deploy/voice-web-r20261025-05`。
- 后端最新编译的9个增量JS与已部署r20261025-04清单逐项一致，保留相同镜像和容器；没有重复迁移或重启。现API仍为上文r04。回退前端优先使用上一成功部署`dpl_G4xzHfAg49G6mtaBFRvAgfNZJkm6`。
- 服务器再次核查：MemAvailable1723MiB、磁盘9.0GiB/85%、load1/5/15为1.25/0.74/0.76；API CPU2.78%、内存71.32MiB/384MiB。ready的PG/Redis为up，Office=true，API OOM=false、restart=0。仍未触发43.130.127.57迁移条件。
- 归档前检查779个可归档文件，未发现私钥或非example的.env文件。源码压缩归档与Git标签在本轮验收后生成，私有测试凭据及.test-runs不进入Git源码。
- 切换完成后，通过显式本机代理在沙箱外复测正式域名：`COLLAB_ACCEPTANCE_PROXY=http://127.0.0.1:6382 COLLAB_BROWSER_CONFIG=.test-runs/deploy/online-config.json VOICE_ONLINE_ACCEPTANCE=1 node node_modules/@playwright/test/cli.js test tests/browser/voice-persona-online.spec.cjs --config playwright.config.cjs --reporter=list --output=.test-runs/voice-persona-online-final-proxy`，**1/1通过，测试1.5分钟、总计1.7分钟**。`.last-run.json`为passed，failedTests为空。两账号原音收发/鉴权下载、重放幂等、组织拒绝、3D偏好持久化与恢复、云服务禁用、邮件仅确认预览全部通过；截图已更新。直连失败后使用既有代理成功，不修改生产网络配置。
- 归档标签采用`collabspace-20261025-voice`，源码压缩包输出到`.test-runs/archives/collabspace-20261025-voice.tar.gz`；对应提交、SHA256和远端核验结果另存同目录manifest，避免归档自引用。归档只包含Git跟踪源码与验收材料。
