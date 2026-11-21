# Office 当前续做入口（2026-10-22）

Office已经按用户明确要求上线，不再是只有隔离开发。正式报告：evidence/collaboration/OFFICE-ONLINE-2026-10-22.md；机器元数据 office-online-2026-10-22.json。

后端r20261022-02/641693b，旧机170.106.161.82；最终前端c40b2ae，Vercel dpl_Gac3sEtHxoWCgvHXJtqjwxWZh2iy，正式collabspace.purelamp.uk。Office引擎新机43.130.127.57原collabspace-office-dev独立容器，回环3390。旧机collabspace-office-link.service持续SSH连接，远端无特权nologin账号只准转发3390，禁止远程监听和shell。旧机回环/Docker私网3396，公网API站点/office-engine路径，callback走正式APIv1。不依赖本机开发隧道。

线上Office三格式一轮3/3（两编辑者+一只读）；最后前端两账号再次打开原生Word并同时显示在线；下载内容、微软12.0保存/新实例重开3/3通过。原六条业务初轮4过2失败，文档按实测慢加载等待复测过，Markdown修复静默列表失败并注入首请求中断后过，合计六流程均覆盖。CI c40b2ae已全绿。正式样本链接在报告，授权已恢复可演示；不要撤销这些样本权限或删数据。

旧机磁盘仅约1.2GB余量98%已用，禁止原机镜像构建或盲清其他项目。新机构建镜像再直传校验，本次压缩传输包已删，新机原包和旧发布镜像保留。临时只读镜像传输公钥已删除。DB13MB，实际本机受限备份486384字节，uploads353字节，catalog可读；私密备份与env在/opt/collabspace/shared，不输出，完整恢复未演练。后续优先规划运行服务迁移/镜像精简，但不要无授权影响其他项目。

共享Caddy常规reload有其他项目配置读权限问题，本轮未改其权限：仅替换运行JSON中的CollabSpace路由并保存私密快照，持久站点文件亦更新。后续同样保护其他运行路由，不直接加载过时整份快照。已有Office文件后不能退到不理解Office ACL的旧API；需冻结/drop会话、停入口并保留新存储授权层。

本测试网络默认浏览器传输曾ERR_CONNECTION_CLOSED，最终使用HTTP1.1 TLS/WSS，无证书或认证绕过。不是全浏览器/HTTP2兼容证明；Office17.8分钟整套验收不是性能成绩。高可用/容量、永久离线Office、完整高级格式、源码/社区许可交付仍待后续。用户已授权部署，不要因旧隔离说明重复索取相同发布许可；私有仓库仍未授权公开。

本机.test-runs包含忽略的凭据配置与辅助脚本、历史trace，禁止入库或输出。不要reset/clean或修改F-U01/其他工作区。先读Git现场状态、实际服务和最新证据；不要相信历史PID或把历史测试当新改动验收。
