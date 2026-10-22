# Office 正式上线与多账号协作验收

日期：2026-10-22。用户明确要求先上线，在正式环境用多个账号同时验证。本报告补充此前隔离验收，不能与此前“尚未上线”的历史快照混淆。

## 实际发布

- 正式前端 `https://collabspace.purelamp.uk`，初次Office部署 `dpl_9bm9izyZWh5b1SYPToAqaXE12V6K` / 641693b；随后仅修复全局Markdown列表的瞬时网络失败恢复，最终 `dpl_Gac3sEtHxoWCgvHXJtqjwxWZh2iy` / c40b2ae。
- 后端 `r20261022-02` / 641693ba873e180ef0474b73829f1306df3c4117，API/WS均健康，数据库/Redis ready；最终检查已连续运行约51分钟。
- ONLYOFFICE保持新机独立容器，原3390仅回环；经服务器间持续SSH连接与既有API域名 `/office-engine/` HTTPS子路径提供编辑器。没有使用本机开发服务、私有开发SDK缓存或iframe替身完成线上验收。
- 部署源码CI：[641693b](https://github.com/chenhynju/collabspace/actions/runs/39773518474)、最终前端修复CI：[c40b2ae](https://github.com/chenhynju/collabspace/actions/runs/39779178202)，均全部通过。源码及证据保留在用户授权私有仓库。

## 线上真实业务结果

| 项目 | 结果 | 实际证据 |
|---|---|---|
| Word | PASSED | 两个编辑账号、一个只读账号；正文含双方输入；参与者真实可见；检查点v2、下载、历史；屏蔽应用通知仍出现原生撤权警告且不再发送编辑写入；私有恢复及重开 |
| Excel | PASSED | 两账号并发修改C4/D4；只读拒绝保存；检查点；全部退出后最终保存v3、无人在线、新会话重开；两个工作表和SUM=5保留 |
| PPT | PASSED | 两账号修改同份演示文稿；只读；检查点；全部退出后最终保存v3并重开；两页、原图及双方文字保留 |
| 最终前端双账号 | PASSED | 文件列表小修复发布后，两个账号再次进入同一已验收Word，真实编辑器ready、双方参与者同时可见并截图 |
| 线上文件内容 | PASSED 3/3 | 实际下载的OOXML逐字核对双方输入及原有结构，不以HTTP200替代内容验证 |
| 微软样本往返 | PASSED 3/3 | 线上下载文件用本机Word/Excel/PowerPoint **12.0**打开、保存副本、全新实例重开；微软保存副本再次通过内容/结构检查。保留一条Word实例退出RPC清理警告 |
| 既有六条业务 | 最终全部覆盖通过 | 初轮IM、Mermaid、图文、跨租户4项通过；文档首次30秒等待失败，实测随后加载，按线上慢网络90秒等待复测完整流程通过；Markdown首次列表网络失败后静默隐藏，修复并注入首次请求中断后完整流程通过 |

三格式Office一轮 **3/3**（约17.8分钟）；最终六条既有业务是“初轮4项 + 文档复测1项 + 修复后Markdown1项”的组合结果，不伪称同一轮6/6。原始首次失败、协议问题与重跑记录保留在本地忽略目录，含临时签名URL的trace不入库。

### 直接查看协作效果

沿用已有演示账号。两个编辑账号分别登录后打开同一链接；第三账号为只读。负向测试结束后已恢复样本授权、Word从最后确认版本重新打开，未清除恢复候选或篡改历史。

- [Word 协作样本](https://collabspace.purelamp.uk/office/b0787d59-71a0-4f50-9bee-3befda8945f2)
- [Excel 协作样本](https://collabspace.purelamp.uk/office/622bad13-0825-4e6c-815b-fcc19d136539)
- [PowerPoint 协作样本](https://collabspace.purelamp.uk/office/04d5b690-7eeb-4764-8688-e369f43665eb)

同一文件的两个独立账号画面：[Word创建者](office-online-2026-10-22-word.png)、[Word第二编辑者](office-online-2026-10-22-word-peer.png)、[Excel创建者](office-online-2026-10-22-sheet.png)、[Excel第二编辑者](office-online-2026-10-22-sheet-peer.png)、[PPT创建者](office-online-2026-10-22-slides.png)、[PPT第二编辑者](office-online-2026-10-22-slides-peer.png)。最终前端再次确认：[账号A](office-live-demo-owner.png)、[账号B](office-live-demo-member.png)。

## 发布中的安全与恢复处理

- 新机完成镜像构建；旧机不构建。镜像经SHA256核对后加载，仅删除本次300MB传输压缩包；旧发布/镜像、数据卷和其他工程保留。不同Docker后端image Size口径不一致，不能按新机压缩大小推断旧机解包占用。
- 初始SSH监听选项被审批拒绝后，没有扩大root远程监听。最终使用无特权远端账号、nologin、ForceCommand false、PermitOpen仅127.0.0.1:3390、AllowTcpForwarding local、PermitListen none；有效配置已核验。私网SSH实测不通，最终走原可信地址的加密连接，没有修改云安全组。
- 镜像传输使用限时、限源、禁止全部转发/交互、只能读取该镜像文件的临时能力，传完即删除；不是持续root shell授权。
- 共享Caddy常规reload因其他项目配置既有读权限失败。没有改其权限或重启共享服务：保存运行JSON，只替换CollabSpace匹配路由，并保留其他运行配置。持久CollabSpace站点文件同步更新。
- 磁盘紧张时，无界本机备份和向本机复制生产备份先后被审批拒绝。经只读实测，本项目DB约13MB、uploads16KB；最终在旧机本项目0600目录用大小门槛、ulimit硬上限创建备份，实际DB归档486384字节、上传归档353字节，catalog可读。没有执行被拒绝的数据站外复制。
- 兼容迁移事务及运行角色CRUD/FORCE RLS检查通过后才切换API/WS，旧发布保留。已有Office文件后不可直接回退至不认识Office ACL的旧API；应保留新存储授权层，冻结/撤销会话后停入口。完整恢复演练未做。

代理按[ONLYOFFICE官方代理说明](https://helpcenter.onlyoffice.com/docs/installation/docs-community-proxy.aspx)设置Forwarded headers。公开保存URL先校验精确origin/前缀、再映射到内部 `/cache/files/`；双重编码等绕过被拒绝。相关真实PG/WS回归32/32通过。

## 诚实边界

测试网络默认浏览器传输曾在页面导航前出现ERR_CONNECTION_CLOSED；随后使用HTTPS HTTP/1.1和WSS完成验收，没有忽略证书、登录或权限。不能据此判断所有用户都有协议故障，也没有完成HTTP2及全面跨浏览器验收。编辑器首次加载曾约35秒，Office整套流程包含较长网络加载，不宣称性能达标。

旧机最终可用约1.2GB（98%已用），持续容量仍需迁移/扩容；本轮没有盲清其他项目Docker。尚未验证：20人Office压测、完整高级格式兼容、永久离线Office编辑、HA及完整灾备恢复。社区版源码/许可交付准备仍未完成，不宣称合规审查通过或擅自公开私有仓库。历史Yjs约0.43秒不是本轮Office性能成绩。

机器可读发布元数据、文件哈希、微软检查及样本地址见 [office-online-2026-10-22.json](office-online-2026-10-22.json)。
