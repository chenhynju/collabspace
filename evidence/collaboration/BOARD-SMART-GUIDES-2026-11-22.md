# 白板智能参考线与层级顺序 — 生产验收（2026-11-22）

## 环境与方式

- 生产前端：https://collabspace.purelamp.uk（部署 `collabspace-bvdake9bc-purelamp.vercel.app`，已别名）
- 验收脚本：`.test-runs/board/smart-guides-probe.cjs`，通过远程无头 Chrome + Playwright 访问生产站点
- 合成数据：线上测试 Owner 与测试项目；探针结束后调用归档接口，不保留测试白板
- 截图：[smart-guides.png](board-ai-2026-11-21/smart-guides.png)

## 结果

| 检查项 | 期望 | 实测 | 结论 |
| --- | --- | --- | --- |
| 拖动吸附 | 靠近另一图元左边缘 3px 时吸附 | 拖动中出现 1 条参考线 | PASSED |
| 吸附精度 | 松手并取消选中后两图元 x 对齐 | `alignedX = 0` | PASSED |
| 参考线清理 | 松手后参考线消失 | `guideAfterRelease = 0` | PASSED |
| 置顶 | 选中图元排在最后（索引 2） | `frontIndex = 2` | PASSED |
| 置底 | 同一图元排在最前（索引 0） | `backIndex = 0` | PASSED |
| 刷新持久化 | 刷新后仍为索引 0 | `reloadBackIndex = 0`、`persisted = true` | PASSED |
| 默认开关 | 智能参考线默认开启 | `guidesToggle = true` | PASSED |

原始输出：

```text
GUIDE_PROBE {"docId":"b23e4f8f-aa23-4e66-bb23-b041b7545e7b","rectCount":3,"guideDuringDrag":1,"alignedX":0,"guideAfterRelease":0,"frontIndex":2,"backIndex":0,"reloadBackIndex":0,"persisted":true,"guidesToggle":true,"errors":["PAGEERROR Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag."]}
```

唯一控制台错误来自第三方 iframe 的 sandbox localStorage 限制，与白板功能无关。

## 覆盖范围

- 智能参考线：拖拽图元或组拖时，将选区包围盒的左/中/右、上/中/下与其它图元的关键线比较，在 6 屏幕像素容差内吸附。
- 层级顺序：单图元属性面板提供置顶、上移、下移、置底；多选工具栏提供置顶与置底。
- 绘制顺序：图元按 `order` 升序绘制；连接线与自由箭头固定渲染在图元之上，避免被图元遮挡。

## 未覆盖 / 边界

- 参考线只做边缘与中心吸附，不做等间距分布提示。
- 层级调整只作用于图元，不改变连接线之间的叠放次序。
- 本轮未做自动布局（流程图）与图层/Frame。
