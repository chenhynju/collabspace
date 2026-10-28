# 数字人基础与解析/支付路由：正式发布验收

2026-10-28；本轮用户明确要求测试、归档并部署，另行明确授权数字人附加生产迁移。不是完整3D、真人生成或正式收款交付。

## 发布身份

- API应用源码：0daaeb5beede7ee03b70473450d239cbdd020998；运行镜像sha256:e5bbfc70a1c93e8d5053e90e163d2bed375c32ed100826f28af39307f626e9a3，tag collabspace-api:r20261028-01。
- 前端：dpl_CZujBVb4WSNKDnGUjkh3fgDMwq2p，https://collabspace-a4iz2koyf-purelamp.vercel.app；已promote到https://collabspace.purelamp.uk。旧前端https://collabspace-n72hltf1q-purelamp.vercel.app保留。
- 旧API镜像sha256:fd64a9f00b066bda9c828c47c543ae7860dcf44cdf35f8fb492992661ee104a8保留。WS镜像未变，未重启文档协作服务。
- 运行配置：服务器/opt/collabspace/shared/persona-release-r20261028-01/base-compose.yml和override.yml，使用同目录600权限env-before；后续操作须保留此overlay，不只重跑历史Compose。回退仅api服务覆盖previous-image，保留新增兼容表/列，不自动回滚或删除业务数据。

## 迁移与备份

管理员旧URL仍指向退役Docker postgres主机名，首次预检查失败，未执行DDL；改用运行API目标后又遇bridge地址HBA拒绝。确认原生PG16 collabspace集群在5543，使用其既有127.0.0.1监听和原管理员凭据后成功；未改pg_hba、密码或网络权限。

完整数据库custom dump为4829055字节、权限600，位于上述服务器目录before-persona.dump；SHA256 7d1c6a970c4b6249c9de420c5512ae63d5f07fa24acd7cae54b80bb2436e076e。验证了管理员可绕过RLS及pg_restore目录包含业务TABLE DATA；本轮没有完整恢复演练。

单事务执行已授权的两张persona表、权限/RLS、清理函数，以及同一功能必需的voice_job.result_visemes列。应用角色验证两表强制RLS、清理执行权限和口型列存在。PERSONA_PURGE_ENABLED=true、AZURE_VISEME_ENABLED=false。私有媒体不上传供应商；访问期7天，清理函数每次最多20条，备份保留另行管理。

原始源码manifest保留；实际使用的原生PG适配脚本SHA、执行路径和保留副本在migration-runner-update.json记录，源文件原位恢复以保留初始manifest可复核性；修正后的脚本随本次证据提交。SDK依赖锁保存在服务器sdk-package-lock.json，SHA256 b5eaaed0a7c90ae3f53552913c02f2b80f70f87c25f2aee5cb18bf7f78853e6b。

## PASSED

| 层次 | 实际结果与边界 |
|---|---|
| 本地API新构建 | nest build退出0；54项中48过、6跳过、0失败，TAP见persona-release-api-20261028.tap。最初误在构建清空dist时启动两项测试，模块未就绪失败；构建完成后才取得该成绩 |
| Linux候选镜像 | 0.5 CPU/384MiB、无网络，解析/超时协议/Stripe/PayPal/素材26/26通过；源manifest/hash验证通过 |
| 冷启动解析 | 独立加载依赖最多20秒，收到READY才发送文件；真实解析仍10秒、总30秒、heap128MiB/并发2；超时503可重试，不冒充格式错误。正式域名合成DOCX提取及错误PDF拒绝1/1通过，未保存源附件 |
| 正式域名形象/素材 | 2/2：20款筛选、知行保存/刷新/Agent展示，最终恢复原选择；合成图片授权、私有读取、他人拒绝、撤销后404，无供应商提交 |
| 正式域名语音 | 合成麦克风录制、WAV/文字发送、幂等、同事鉴权播放通过；STT/TTS编排fixture通过，不能算Azure调用 |
| 邮件安全 | 麦克风拒绝正常反馈；配置了真实Resend的线上环境允许打开预览，但不点确认发送且断言零POST。原测试错误假定发送按钮应禁用而失败，改为区分配置状态、验证预览边界后单项1/1通过；未真实发信 |
| Mermaid回归 | 实际画布拖入/移动、刷新/双编辑同步、局部删除和Viewer拒绝1/1通过；新增独立截图，不覆盖历史截图 |
| 支付路由 | 当前正式域名两configuration均200，修复缺Controller注册引起的404；Stripe enabled=false/test，PayPal enabled=false/sandbox，未创建支付或订阅 |
| 前端构建/发布 | Vercel生产目标构建成功，显式固定公开API/WS地址，skip-domain后promote；首次未指定团队返回Not authorized，显式scope purelamp后成功，未更改登录凭据 |

## 资源与剩余边界

发布后复核：API约92.1MiB/384MiB、CPU0.10%，OOM=false、重启0；WS27.03MiB。主机可用内存1759MiB，磁盘可用8.5GB、使用86%。未达到迁移条件，未迁移或清理其他项目；没有长期压力或HA/恢复通过声明。

真实Azure STT/TTS、viseme模型实机、正式VRM/捏脸、本人照片/视频真人供应商生成，以及完整持久Agent/Skill运行时仍未完成。Stripe/PayPal凭据与价格映射均未配置，官方沙盒重验BLOCKED，不代表Live商户资格。缺失项汇总见docs/collaboration/CURRENT-STATUS-2026-10-28.md。

旧两次单次接力collabspace-00-42、collabspace-05-44已通过恢复可用的automation工具删除，不再重复执行。原始发布/测试日志在忽略目录.test-runs/deploy/，真实密钥、数据库备份和私密配置未入仓库。
