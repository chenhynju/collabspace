# Office 续做入口（2026-10-22）

本轮已按用户最新指示立即开发，没有新建10月23日定时任务。正式说明见 OFFICE-INTEGRATION-2026-10-22.md，证据见 evidence/collaboration/OFFICE-INTEGRATION-2026-10-22.md。

Office 应用集成代码目前在本轮工作区：三格式真实应用浏览器已一轮3/3，既有业务浏览器6/6，非特权PG/WS32、API含真实Redis19、Web7与API/Web构建通过。追加所有人关闭后的最终保存/重开2/2和Microsoft12.0保存/新实例重开3/3已通过，读证据了解样本边界。公开Office发布、源码/许可证交付仍未完成；生产仍为79971e6/r20261022-01的Markdown功能，不把本轮开发验证当线上验收。

## 隔离环境

先核验实际端口/命令行，不信历史PID。独立PG5548、Redis6399、API53121、WS53122、Web53120；启动辅助脚本均在忽略的.test-runs目录。Office私密环境 .test-runs/office-integrated/config.json 不打印。当前.next-office构建已完成；API/Web16:24启动时已加载最新TypeScript构建，本轮后续仅改测试/说明/初始化脚本。

新机43.130.127.57仅独立collabspace-office-dev，引擎回环3390。2026-10-22追加验收时，原本机SSH进程退出，远端3392仍被旧sshd占用；已现场确认仅持有此开发转发的sshd PID933479并结束，未影响其他会话。引擎当时Up15h healthy。已用隐藏后台ssh进程恢复相同受限转发，本轮PID5080：本机3390→远端3390，远端3392→本机53121。ServerAliveInterval15/CountMax3，key仅允许这两个转发且禁止shell。此连接是开发隧道，不是生产高可用方案。

回环3395开发静态缓存只缓存公开版本SDK/UI/字体，动态文档/WS/回调仍真实转发3390。远端172.17.0.1:3393 API桥接3392；不开放公网，不把ALLOW_PRIVATE_IP的开发Compose当生产模板。

## 恢复和归档

不reset/clean，不改F-U01/其他工程，不输出server_config、SSH私钥、JWT/cap签名URL或数据库连接。原测试覆盖的历史截图和browser-results已先备份忽略目录再以git show恢复，新增Office证据使用独立前缀。Next自动增加的tsconfig生成include已恢复。

本轮代码需经最终证据核对后提交推送授权私有chenhynju/collabspace；是否已提交以现场Git为准。不要因旧BASELINE重复创建仓库。Office公开发布需具体路由、源码交付和线上验收；不要擅自公开整个私有仓库或购买商业授权。
