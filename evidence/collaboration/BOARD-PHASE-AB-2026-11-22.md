# 白板 Phase A/B 生产验收（2026-11-22）

本文件记录白板八项增强的生产验收。Phase A 覆盖导出、持久分组/锁定/旋转、Frame/图层、自动布局、形状库、`.drawio`；Phase B 覆盖评论 @提及通知与公开只读分享。

## 环境与方式

- 生产前端：https://collabspace.purelamp.uk
- 生产 API/WS：容器 `collabspace-api-1` / `collabspace-collab-1`，发布 `api-r20261122-01`
- Phase A 探针：`.test-runs/board/canvas-parity-probe.cjs`（`run-canvas-parity-probe.py` 远程执行）
- Phase B 探针：`.test-runs/board/phase-b-probe.cjs`（`run-phase-b-probe.py` 远程执行）
- 方式：远程无头 Chrome + Playwright 访问生产站点；合成数据为线上测试 Owner、测试成员与测试项目，探针结束不保留测试白板
- 截图：[phase-b-deeplink.png](../../.test-runs/board/phase-b-deeplink.png)；Phase A 截图 `canvas-parity-probe.png`

## Phase A 结果（canvas-parity）

| 检查项 | 期望 | 实测 | 结论 |
| --- | --- | --- | --- |
| 导出 PNG | 有效 PNG 文件 | `pngBytes=168802`，`pngSignature=89504e47` | PASSED |
| 导出 PDF | 有效 PDF 头 | `pdfBytes=97267`，`pdfHeader=%PDF` | PASSED |
| 分组持久化 | 分组后刷新仍在，且整体拖动 | `groupDeltas=[[54,35],[54,35]]`，`groupAfterReload` 含“分组/锁定”菜单 | PASSED |
| 锁定 | 锁定图元拖动位移为 0，但仍可评论 | `lockedDelta=[0,0]`，`lockedCommentBox=1` | PASSED |
| 旋转持久化 | 角度写入并在刷新后保留 | `rotation=rotate(30 …)` = `rotationAfterReload` | PASSED |
| Frame 裁切与移动 | 子图元被 Frame 裁切，Frame 与子图元同步位移 | `childClipped=url(#r0-frame-…)`，`frameDelta == frameChildDelta` | PASSED |
| 图层显隐/锁定/排序 | 隐藏计数与锁定位移正确，顺序可调整 | `hiddenCount=0`，`layerLockDelta=[0,0]`，`layerOrder=[2,1]` | PASSED |
| 自动布局 | 布局改变且一次撤销回退 | `layoutChanged=true`，`layoutUndo=true` | PASSED |
| 形状库搜索 | 关键词命中并创建图形 | `k8sSearch=1`，`k8sCreated=1` | PASSED |
| `.drawio` 导出/导入 | 可导出并可再次导入 | `drawioExport=true`，`drawioImportDelta=14` | PASSED |

原始输出：

```text
CANVAS_PROBE {"docId":"3846614c-bb47-4432-96de-e2edaf954cba","rectCount":3,"groupSelected":"已选 2 个\n左对齐\n水平居中\n右对齐\n顶对齐\n垂直居中\n底对齐\n水平分布\n垂直分布\n置顶\n置底\n分组\n取消分组\n锁定\n解锁\n复制所选\n删除所选","groupDeltas":[[54,35],[54,35]],"groupAfterReload":"已选 2 个\n左对齐\n水平居中\n右对齐\n顶对齐\n垂直居中\n底对齐\n水平分布\n垂直分布\n置顶\n置底\n分组\n取消分组\n锁定\n解锁\n复制所选\n删除所选","lockedDelta":[0,0],"lockedCommentBox":1,"rotation":"rotate(30 675.5311279296875 434.9084167480469)","rotationAfterReload":"rotate(30 675.5311279296875 434.9084167480469)","childClipped":"url(#r0-frame-314930d8-eea6-41e4-8f0c-7fbc73899142)","frameDelta":[36.630035400390625,29.30401611328125],"frameChildDelta":[36.630035400390625,29.30401611328125],"hiddenCount":0,"layerLockDelta":[0,0],"layerOrder":[2,1],"layoutChanged":true,"layoutUndo":true,"k8sSearch":1,"k8sCreated":1,"pngBytes":168802,"pngSignature":"89504e47","pdfBytes":97267,"pdfHeader":"%PDF","drawioExport":true,"drawioImportDelta":14,"errors":["PAGEERROR Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag."]}
```

## Phase B 结果（@提及通知 + 公开分享）

| 检查项 | 期望 | 实测 | 结论 |
| --- | --- | --- | --- |
| 白板在线与持久 | 保存到服务器，图元已落库 | `online=true`，`persistedShapes=1` | PASSED |
| 无权限不可 @ | 授权前成员不在候选列表 | `mentionBeforeHasMember=false` | PASSED |
| 授权后可 @ | 授予 COMMENTER 后出现在候选 | `grantStatus=200`，`mentionAfterHasMember=true` | PASSED |
| 提及 chip 与草稿 | 点击 chip 写入 `@成员 ` | `chipVisible=1`，`draftAfterChip="@陆小鹿 "` | PASSED |
| 通知中心未读 | 被提及成员出现未读提及 | `notificationVisible=1`，`unreadBefore=1` | PASSED |
| 深链定位图元 | 点击后切到画布并选中图元、打开评论 | `memberCanvasVisible=1`，`commentPanelVisible=1`，`deepLinkCommentText=3` | PASSED |
| 阅读后已读 | 打开后未读清零 | `unreadAfter=0` | PASSED |
| 不自我通知 | 操作者收不到自己的提及通知 | `actorOwnMentionVisible=false` | PASSED |
| 创建公开链接 | 生成 `/share/<token>` | `shareLink=true` | PASSED |
| 公开只读 | 外部可读且只读，显示有效期 | `publicStatus=200`，`publicReadonly=1`，`publicExpiryText=1`，`publicBoardSvg=1` | PASSED |
| 不泄露内部能力 | 无分享/导出/锁定等内部控件 | `publicHasShareButton=0`，`publicForbiddenControls=0` | PASSED |
| 撤销生效 | 撤销后链接失效 | `revokedMessage=1` | PASSED |
| 健康检查 | API 正常 | `health=ok` | PASSED |

字段结果（2026-11-22 生产探针运行记录）：

```text
PHASE_B_PROBE {"online":true,"header":"已保存到服务器 · OWNER | 陈知微 · 1 人在线","persistedShapes":1,"mentionBeforeHasMember":false,"grantStatus":200,"mentionAfterHasMember":true,"chipVisible":1,"draftAfterChip":"@陆小鹿 ","notificationVisible":1,"unreadBefore":1,"unreadAfter":0,"memberCanvasVisible":1,"commentPanelVisible":1,"deepLinkCommentText":3,"deepLinkUrl":"…/documents/68328ba9-…?thread=5ced400b-…&shape=7c9187cc-…","shareLink":true,"publicStatus":200,"publicReadonly":1,"publicExpiryText":1,"publicBoardSvg":1,"publicHasShareButton":0,"publicForbiddenControls":0,"revokedMessage":1,"actorOwnMentionVisible":false,"health":"ok"}
```

## 实现口径

- 持久布局与层信息写入 `boardMeta`（`group|locked|rotation|frame|layer:<id>` 与 `layers`），协作文档校验已放行 `boardMeta`；WS 服务需与 API 同步更新 `packages/collab-store`，否则新的元数据会被拒绝并断连。
- 导出在浏览器端由画布生成 SVG，再转 PNG（2x）或 PDF，保留文字、便签、箭头与中文字体。
- 自动布局读取连接线构建有向图分层，整次布局在单次事务内提交，一次撤销回退。
- @提及候选只返回对文档有权限且状态正常的成员；评论/回复写入时由 store 解析 `@Name` 写入 `collab_board_notification`（排除操作者）；通知中心把 `personal_notification` 与 `collab_board_notification` 合并为 `invitation|board_mention`。
- 公开分享写入创建时 JSON 快照 `collab_share`，公开读取走 `GET /shares/:token` 并以 `app.share_public='on'` 的独立 RLS 策略按 token 读取；可设 1–30 天到期与撤销，不暴露实时 Y.Doc 与组织内其他资源。

## 未覆盖 / 边界

- 控制台仍有一条第三方 Mermaid iframe 的 sandbox localStorage 报错，与本功能无关。
- 公开分享只提供只读快照，不提供外部实时协作；复杂渐变/图片导出按画布能力近似。
- `.drawio` 以图形/文字/连接线的迁移为目标，不承诺 Visio 全兼容。
- 自动布局的连线走向为启发式（正交/曲线），极端密集图可能需要手动微调。

## api-r20261122-02 再发布核验（2026-11-22）

- 发布源码固定为 `22cb45ce592501a98124db2b0d9b2e68aa4d546f`（标签 `collabspace-20261122-board-phase-ab`）。发布工作树中的 3 个未提交旧文件覆盖未纳入构建，也未被还原或删除。
- 不可变源码归档：`.test-runs/board/collabspace-22cb45c-source.tgz`，SHA-256 `F7A5A37910FF33D5B0E88D8B3CC5E820007B7AE93B907A1E3B814F04F8BCE6F5`。
- Vercel 生产部署 `dpl_3ThTHJ9cogELsNWoLNdJs2d4S4QZ`：`Ready`，生产构建完成 TypeScript 检查，别名包含 `https://collabspace.purelamp.uk`。
- API/WS 镜像分别为 `collabspace-api:api-r20261122-02`、`collabspace-ws:api-r20261122-02`。公开健康检查与 WS readiness 均通过，两个容器均为 `healthy`、`RESTARTS=0`、`OOM=false`。
- Phase A 重新实跑通过：`docId=38081a43-972d-4646-895e-81e444b7b4e0`；分组、锁定、旋转、Frame、图层、布局撤销、K8s 搜索、PNG/PDF 与 drawio 往返结果均符合上表断言。
- Phase B 重新实跑通过：`docId=862ecc10-9b3b-4d6b-9263-c3a05a29b684`；越权不可提及、授权后候选、通知未读/已读、深链、公开只读和撤销均符合上表断言。
- 标准账号目录只读核验：6 个合成账号均为 `NORMAL` 且成员关系为 `ACTIVE`；Acme 含 OWNER/ADMIN/MEMBER，Globex 含 OWNER/MEMBER，平台运营空间含平台超管兼 OWNER。未读取或输出密码、Token、连接串。
