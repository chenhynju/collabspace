# IM听写改版与受限运行时验收

基线d191ef6。2026-10-25用户确定Azure STT+TTS同时面向国内外，OpenAI作为未来海外版选项；未开通Azure或真人视频服务。本轮不创建付费资源、不真实发信。

## 实际变化

- IM改为话筒主入口、录音计时/真实音量、取消/确认、转写追加原草稿并回到输入框、用户手动发送。原音/朗读/历史收进语音选项。输入法合成Enter不发送，草稿自适应高度。
- 未配置时解释不可用，原音仍可使用；失败保留原草稿和本地录音，UNKNOWN阻止盲重试。旧工具与听写互斥。中文/英文显式选择，异步偏好不能覆盖用户选择。
- Azure明确global/china端点，地区混用/未知cloud失败关闭；中国云资源需独立核对。真实STT/TTS仍BLOCKED，不能把浏览器替身记成识别效果。
- 受限助手工作流：鉴权后实际读取项目名称与任务数，调用现有DeepSeek，服务端确认结果后给出状态与结果引用。能力白名单、同编号幂等/冲突、同时1任务、取消信号、撤权后不返回结果。没有任意工具执行或自动发信。
- 运行收据仅进程内15分钟，重启不可恢复；不是持久化/自治Agent平台。没有新增数据库迁移或常驻worker。

## PASSED

| 验证 | 实际结果 |
| --- | --- |
| API构建 | pnpm --filter @teamspace/api run build 退出0 |
| 前端类型 | tsc --noEmit --incremental false 退出0 |
| Web生产构建 | .next-agent-voice-release构建退出0，38页面；后续焦点和展示调整由类型/浏览器及发布候选构建覆盖；存在既有lint警告 |
| API串行回归 | 50项，44通过、6可选集成跳过、0失败，87.7秒；其后新增Azure路由定向验证，不把跳过计通过 |
| 运行时+语音定向单测 | 9/9，含取消、撤权、不完整结果、幂等、进程内过期、global/china域名及失败关闭 |
| 新听写浏览器 | im-dictation.spec.cjs最终5/5，3.5分钟；缺少配置解释、不自动上传、PCM替身转写、保留/编辑草稿、手动发送、录音取消释放、UNKNOWN保留录音/不重复调用，以及时长上限停止后必须确认才上传 |
| 语言偏好竞态追加 | 1/1，22.8秒；迟到的中文偏好不能覆盖用户已选English，上传locale为en-US |
| 原有语音回归 | voice-persona.spec.cjs + voice-boundaries.spec.cjs 5/5，2.0分钟；原音、TTS停止/旧结果失效、邮件不外发、权限/坏文件等保留 |
| 真实运行时浏览器 | assistant-runtime-real.spec.cjs 1/1，39.2秒；实际隔离PG读取+一次真实DeepSeek生成，207 token，非缓存，结果完整；同编号重放同结果、改输入409、另一actor404 |

真实模型结果逐项检查：Alice周五交付、Bob周四审查、尚未发送邮件、部署需确认、测试覆盖不完整均体现在输出，未把草稿说成已经发信或部署。原始合成资料与结果在agent-runtime-real.json，无真实客户资料或凭据。

## 失败与修复记录

- 首次真实运行时浏览器在登录后dashboard跳转等待超时；trace显示真实登录201、profile/org200。未进入生成。测试改为真实API登录后直接访问助手，独立于无关dashboard编译，后续真实运行通过。
- 新听写初次1/4通过：两项alert选择器与Next路由公告冲突；一项真实焦点回填失败。为提示增加可访问名称，焦点改为等待输入框解锁后恢复；最终4/4通过。没有删除相应断言。
- 本地仍无Redis6399，既有invitation_delivery初始化缺失会报调度错误；不计为Redis/邀请或多worker验收。
- 发布后复查发现达到录音上限会自动提交，改为59秒停止后进入待确认。新增加速浏览器时钟验证：停止后STT请求0次，点击确认后1次；本地最终5/5通过。此测试不代表实际59秒音频的识别质量。

## BLOCKED / NOT_RUN

真实Azure STT/TTS、中英混说质量、全球/中国云网络与音色效果、真人视频供应商、有效VRM资产、精确viseme、持久Agent调度、多进程Agent恢复、真实邮件投递、货币硬预算、无人访问时定时物理清理仍未验收。本轮收据可取消和过期，不代表具备持久重启恢复。

## 发布与回退

本地成绩以上述命令为准；正式发布身份与上线后验收在本节追加。目标为现有站点，API从已核对r20261025-04固定镜像增量覆盖6个JS，无依赖安装或数据库迁移；只重建API，WS/Office保持。回退API r20261025-04，前端回退dpl_3Ab9wM6uNvN9G79qA6m85xnmDfSv，不回滚业务数据。

部署前服务器抽样：2CPU/3723MiB，总可用内存1691MiB，磁盘8.9GiB/85%，load1/5/15=1.46/1.02/0.89；API73.8MiB/384MiB、CPU0.12%、OOM=false、restart0。满足现门槛，不触发迁移43.130.127.57。

### 本次正式发布身份

- 应用源码提交7e1adf356856878006bdd6d5b83f0e2b0b2f1291。前端123文件快照哈希9474c6f65860952fbd77bb9032b9493f5a04b0f78c2fd222d60fab2677eaa1d5。
- Vercel dpl_2VYGL3gHuLgKPv9uRqBDeiHpcr2G，候选https://collabspace-axbhqfh0t-purelamp.vercel.app，构建1分17秒、inspect Ready并promote成功。
- API collabspace-api:r20261025-06，sha256:fd64a9f00b066bda9c828c47c543ae7860dcf44cdf35f8fb492992661ee104a8，在原r04上只覆盖6个JS；没有依赖安装或数据库迁移。
- 上传包10232字节，SHA256 71f04d3e19a5c3d56a1c6c2f6aa95d1f89eccdfb44f1cd33144c89c50259ac96。远端逐文件清单/源码标签核对通过，离线构建限制256MiB/0.5CPU，Linux加载烟测192MiB/0.5CPU。
- 首次烟测误用相对路径，实际镜像WORKDIR为/app/apps/api，故找不到模块；修正为绝对路径后加载通过，才切换API。新增smoke恢复阶段，未反复重建。服务器基础Node20.20.2，本地Node22；正式实际调用成绩需单独验证。
- SFTP、传统SCP和直接stdin上传被直连重置，残留的是本轮0字节候选文件；正式应用未提前切换。通过本机既有HTTP代理CONNECT传输、保持StrictHostKeyChecking，上传成功并核对相同SHA256；没有修改全局代理、服务器网络/防火墙或证书验证。
- 切换前配置备份/opt/collabspace/shared/env-before-r20261025-06与镜像身份image-before-r20261025-06。此轮没有新增整库备份或恢复演练，不把r04已有备份当成本轮新备份。回退不覆盖业务数据。
- 只重建API，WS镜像与Office保持。切换后ready的DB/Redis均up、Office=true、OOM=false/restart0，API66.8MiB/384MiB、1CPU上限、CPU4.85%启动短样本；可用内存1721MiB、磁盘8.9GiB/85%、load2.00/1.47/1.25。不是长期容量/压测成绩。
- 正式API辅助回归再次通过：语音状态、人类身份、未配置TTS503、外国组织403、Linux DOCX提取。Azure/真人仍未配置。

### 上线后业务验收

设置COLLAB_BROWSER_CONFIG=.test-runs/deploy/online-config.json、COLLAB_ACCEPTANCE_PROXY为本机既有代理，显式打开AGENT_REAL_ACCEPTANCE/AGENT_REAL_ONLINE/IM_DICTATION_ONLINE/VOICE_ONLINE_ACCEPTANCE，运行assistant-runtime-real.spec.cjs、im-dictation.spec.cjs、voice-persona-online.spec.cjs。**6/6通过，3.5分钟**，结果`.test-runs/dictation-runtime-online/.last-run.json`为passed、failedTests为空。

- 正式真实DeepSeek工作流：210 token、非缓存、输出完整；项目事实实际读取（任务数3）、幂等重放同结果、输入更改409、另一actor404。语义逐项检查保留Alice/Bob职责、周五/周四、未发信、部署需确认与测试覆盖风险。证据agent-runtime-online.json/png。
- 新听写四项：实际生产前端紧凑布局与未配置提示；假麦克风经真实MediaRecorder/PCM转换，**仅STT接口使用浏览器显式替身**；语言竞态保护、草稿追加/焦点恢复、人工编辑后手动文本发送；取消释放麦克风；UNKNOWN保留录音、不重复提交。不是Azure真实识别成绩。截图im-dictation-online-idle/recording.png。
- 正式原音、3D偏好保存/恢复、第二账号私有媒体鉴权与重放、跨组织拒绝、邮件仅预览通过；真实邮件POST被拦截且计数0。没有真实测试发信或真人生成。
- 发布候选构建使用源码7e1adf3，包含最终焦点和卡片调整；上线后测试验证实际生产bundle，而不是拿早先本地构建代替最后源代码验收。

本轮测试启动器在正常关闭独立PG后结束，仅保留.test-runs合成数据和本地证据。源码及上线证据使用collabspace-20261025-dictation标签归档，压缩包与SHA256清单保存在.test-runs/archives；不纳入.env、凭据、node_modules或测试库。

上线验收后再次核查：2026-10-25 21:25北京时间，MemAvailable1685MiB、磁盘8.9GiB/85%、load0.84/0.80/0.96，API66.63MiB/384MiB、CPU0.12%、OOM=false/restart0；DB/Redis up、Office=true。无迁移条件触发。当时5小时额度剩余50%，未达到低于10%的接力任务条件。

### 时长确认修正版 r20261025-07

- 仅发布前端：源码ca27b28，123文件快照SHA256 0b104b38becd2e48ff7da5a5e58803ee3c9ca8b11ddf86a67609f5bae9ab9744。API保持r06与上述fd64a9f镜像，未重启后端、未执行迁移。
- Vercel dpl_27jPmU8M39BxhgVyMqrs8Yfx8885，https://collabspace-9f6rrdvsc-purelamp.vercel.app，构建1分12秒，inspect Ready、promote成功。前端回退可用上一版dpl_2VYGL3gHuLgKPv9uRqBDeiHpcr2G。
- 首次上传连接中断，核查部署列表没有新候选；通过已有本机HTTPS代理重试成功，未修改全局网络设置。
- 21:48北京时间复核：MemAvailable1669MiB、磁盘8.9GiB/85%、load0.39/0.52/0.62；API73.23MiB/384MiB、CPU15.60%瞬时样本、OOM=false/restart0，DB/Redis up、Office=true。没有触发迁移条件，不将瞬时采样当压测。
- 最终正式域名听写专项5/5通过，1.9分钟，`.test-runs/im-dictation-cap-online/.last-run.json`为passed、failedTests为空。第五项以加速浏览器时钟确认59秒停止后请求0次、明确确认后1次；另外四项继续保留原有断言。STT仍为显式接口替身，不计真实Azure识别成绩。新截图已人工检查录音条、取消/确认及隐私说明。
- 最新5小时额度剩余35%，条件未触发，未创建10月26日00:42、05:44接力任务。发布和验收已完成；剩余真实供应商验收等待开通配置，不以定时重跑替代凭据。
