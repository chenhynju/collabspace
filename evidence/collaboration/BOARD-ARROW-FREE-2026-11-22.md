# 白板自由箭头与绑定箭头验收（2026-11-22）

## 修复内容

- “箭头 / 连线”现在支持两种拖法：
  - 从一个图元内部拖到另一个图元：生成绑定连接线，随图元移动。
  - 从空白处拖动：生成自由箭头，记录 `points.x1/y1/x2/y2`，不绑定图元。
- 连接线协议新增可选 `points`；绑定连接线继续使用 `binding.from/to`。
- `fitItems`、导出 SVG 和“适应全部”把自由箭头起止点纳入边界，避免画完箭头后被视图裁掉。
- 自由箭头在属性面板中只显示文字/删除，不显示无效的 X/Y/宽高。

## 根因

前端先更新了协议，但 API 容器和协作服务容器里的 `packages/collab-protocol/index.cjs` 仍是 2026-10-24 旧版，自由箭头的 `points` 在协作服务校验时被拒绝。已将新版协议同步到两个运行容器并重启：

- `collabspace-api-1`
- `collabspace-collab-1`

重启后 health `database/redis up`，OOM=false、restarts=0。

## 生产验收

探针在新建临时白板上执行：

| 检查 | 结果 |
| --- | --- |
| 空白处拖出自由箭头 | 1 条 |
| 图元间拖出绑定箭头 | 第 2 条 |
| 独立箭头图形 | 0 个 |
| 刷新页面后连接线数量 | 2 条 |
| 控制台错误 | 仅第三方 iframe 的 sandbox localStorage 警告 |

前端部署：`collabspace-iel3xqdex-purelamp.vercel.app`，已别名到 `https://collabspace.purelamp.uk`。
截图：[自由箭头 + 绑定箭头](board-ai-2026-11-21/free-arrow.png)。

## 边界与后续

- 自由箭头不绑定图元，移动图元时不会跟随；AI 的 `connect` 仍只生成绑定连接线。
- 协议文件当前通过 `docker cp` 同步到运行容器；下一次重建 API/协作镜像时，需要把新版 `packages/collab-protocol/index.cjs` 打进镜像，否则会被旧镜像覆盖。
- 自由箭头暂不支持拖动端点编辑；可删除后重画。
