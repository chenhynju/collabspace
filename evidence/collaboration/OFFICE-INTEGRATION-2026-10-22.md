# Office 隔离应用集成验收 — 2026-10-22

本轮在 CollabSpace 实际登录、文件、成员与项目 ACL 上验证，不是旧引擎 harness。前端使用 Windows Next 生产构建；隔离 PG5548、Redis6399、API53121/WS53122/Web53120；新机独立 ONLYOFFICE 经私有转发访问。未接入生产账号或生产文件，未公开部署 Office。

| 项目 | 结果 | 实际覆盖 |
|---|---|---|
| 三格式真实浏览器 | PASSED 3/3 | 上传、真实原生编辑器、双编辑者和只读账号、实际参与者、检查点、下载与历史 |
| Word 撤权/恢复 | PASSED（含在3项内） | 屏蔽应用轮询后仍收到原生访问/保存警告；正向写入存在、撤权后不再发送编辑写入；config拒绝；原版本不覆盖；私有副本及刷新重开 |
| Excel/PPT最终关闭/重开 | PASSED 2/2 | 所有人离开→最终保存→CLOSED/无人在线→新会话打开→确认内容 |
| 既有六项浏览器 | PASSED 6/6 | 文档、IM不重复、原生Markdown、Mermaid、图文、双租户HTTP及WS |
| 真实非特权PG/WS | PASSED 32/32、0跳过 | 新Office生命周期/提交失败不ACK/重试/下载中撤权/直接RLS/权限上限，及已有协作回归 |
| API含真实Redis | PASSED 19/19、0跳过 | 含OAuth浏览器绑定/PKCE/单次消费等已有安全回归；不等于线上OAuth供应商接通 |
| Web单元 | PASSED 7/7 | 既有租户状态/编辑状态等 |
| Windows构建 | PASSED API、Web | 本轮最终TypeScript与Office页面；后续仅补测试/说明及初始化脚本 |
| OOXML内容 | PASSED 3/3 | 双方标记、Word表格/图片、Excel两表及SUM=5、PPT两页及图片 |
| Microsoft Office | PASSED 3/3选定样本 | 本机Word/Excel/PowerPoint **12.0**打开→保存副本→全新应用实例重开，再核对内容；微软副本再次通过OOXML结构检查 |

原生界面证据：[Word](office-integrated-word.png)、[Excel](office-integrated-sheet.png)、[PowerPoint](office-integrated-slides.png)、[屏蔽应用通知时的原生撤权警告](office-integrated-revoked.png)。

机器可读结果及最终下载/微软保存副本SHA-256：[office-integration-2026-10-22.json](office-integration-2026-10-22.json)。样本是生成的合成内容，私密配置和原始trace不入库。脚本：`tests/browser/office.spec.cjs`、`tests/office-dev/verify-integrated.py`、`tests/office-dev/verify-microsoft.ps1`。详细运行命令和配置边界见 `docs/collaboration/OFFICE-INTEGRATION-2026-10-22.md`。

## 失败与修复记录

1. Nest默认POST201被引擎拒绝，回调改为HTTP200；成功仍取决于事务提交，不以200冒充保存。
2. 隔离SSH通道静态资源约30–35KB/s，原生编辑器曾加载超时。仅公开版本化SDK/UI/字体加入开发缓存；文件、回调、WS未缓存。这不证明生产加载速度或Office离线编辑。
3. Word撤权后原生弹窗阻止画布操作，测试不能点击穿透；改为核实原生警告和无新写入。另修正Next隐藏公告导致的alert选择器歧义。
4. 同时运行的Playwright最初共用输出目录，trace互相删除。后续独立输出目录，一轮3/3重新通过。
5. PPT原测试坐标落在文本框外，End跳到第二张空白页，产生“无更改”。按实际截图/画布边界修正后，下载逐字确认双方输入。
6. 追加关闭测试时本机SSH进程退出，远端开发转发残留。只结束现场确认持有3392的旧转发会话并恢复相同受限隧道；健康检查200/true后重新跑2/2。
7. 微软旧版COM参数及关闭最后文档后实例结束行为导致辅助脚本前两次失败；修正调用并以新实例重开后通过。仍记录一条 **Word first-instance quit RPC** 清理警告，未掩盖文档检查错误，不影响成功保存副本及新实例验证。

## 未验证/未交付边界

- NOT_RUN：Office公网部署与线上账号业务验收、生产备份/回滚、首次bootstrap完整容器运行。
- NOT_RUN：新版Microsoft 365全面排版兼容、旧格式/宏/加密、复杂链接/外部数据源、原生Office评论全流程、永久离线编辑、容量/性能/HA与多实例。
- Office引擎使用官方固定摘要镜像，当前社区版开发隔离；源码/许可证公开交付尚未完成，不擅自公开私有仓库或购买授权。
- 之前约0.43秒是用户接受的Yjs本地基线；本轮没有重测或声称Office达到该延迟，也没有改写旧失败压测证据。

生产仍是此前已上线的Markdown版本。本报告的PASSED均限定于上表环境和样本，不能写成Office已经公开上线。
