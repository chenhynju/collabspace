# Mermaid 开关视图与白板图元评论 — 生产验收（2026-11-22）

## 环境与方式

- 生产前端：https://collabspace.purelamp.uk（部署 `collabspace-ca5sq74m2-purelamp.vercel.app`，已别名）
- 验收脚本：`.test-runs/board/comments-probe.cjs`，通过远程无头 Chrome + Playwright 访问生产站点
- 合成数据：线上测试 Owner 与测试项目；探针结束后调用归档接口，不保留测试白板
- 截图：[review-comments.png](board-ai-2026-11-21/review-comments.png)

## 结果

| 检查项 | 期望 | 实测 | 结论 |
| --- | --- | --- | --- |
| Mermaid 默认视图 | 默认图元视图 | `defaultGraphChecked = true` | PASSED |
| 切到源码 | 开关关闭、源码出现 | `sourceChecked = false`，源码可见 | PASSED |
| 切回图元 | 源码隐藏、图表渲染 | `sourceVisibleInGraph = 0`，图内出现“开始” | PASSED |
| 图元评论 | 发表后出现 1 条评论与 1 个徽标 | `threadCount = 1`、`pinAfterCreate = 1` | PASSED |
| 刷新持久化 | 评论与徽标仍在 | `pinAfterReload = 1`、`threadAfterReload = 1` | PASSED |
| 评审模式 | 面板出现，未评论图元弱化 | 面板 1 个；不透明度 `["1","0.3"]` | PASSED |
| 标记解决 | 状态变为已解决 | `resolvedStatus` 含“已解决” | PASSED |
| 回复 | 回复内容出现在线程中 | `replyVisible = true` | PASSED |
| 解决后徽标 | 普通模式不再显示待处理徽标 | `pinsAfterResolve = 0` | PASSED |
| 刷新后状态 | 解决与回复保留 | `persistedResolved = true`、`persistedReply = true` | PASSED |

原始输出：

```text
COMMENT_PROBE {"docId":"acee1091-dd54-47af-9a80-dbed3b88098f","defaultGraphChecked":"true","sourceChecked":"false","sourceVisibleInGraph":0,"graphText":true,"rectCount":2,"threadCount":1,"pinAfterCreate":1,"pinBadge":"图元评论：1 条","pinAfterReload":1,"threadAfterReload":1,"reviewPanel":1,"opacities":["1","0.3"],"reviewPins":1,"resolvedStatus":"已解决\n\n定位\n开始\n\n请确认这个节点的负责人\n\n重新打开\n回复","replyVisible":true,"pinsAfterResolve":0,"persistedResolved":true,"persistedReply":true,"pinsAfterReload":0,"errors":["PAGEERROR Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.","PAGEERROR Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag."]}
```

控制台错误来自第三方 Mermaid iframe 的 sandbox localStorage 限制，与本次功能无关。

## 实现口径

- Mermaid 工作区只有“源码 / 图元”两个状态，用 `role="switch"` 的开关切换；源码是权威，图元拖拽仍回写源码。
- 图元评论复用文档评论表与权限：锚点编码为 `shape:<图元ID>`，评论正文、回复、解决状态和审计沿用 `collab_thread` / `collab_reply`。
- 评审模式不改变编辑权限，只弱化没有待处理评论的图元，并提供“下一处待处理”、定位、解决与回复。
- 评论通过协作文档元数据失效通知刷新，另有 30 秒兜底轮询。

## 未覆盖 / 边界

- 图元删除后评论保留，面板显示“图元已删除”，不能定位但可解决。
- 本轮未做 @提及、通知中心提醒与评论附件。
- Mermaid 开关只改变展示，不改变源码权威与协作通道。
