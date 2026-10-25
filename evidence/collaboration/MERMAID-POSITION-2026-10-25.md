# Mermaid 实际画布定位与部分删除：开发中

2026-10-25用户反馈对应P/BR/D/AT-MPOS。**未发布，尚未完成验收**。基线14c2779；本轮源码在codex/mermaid-canvas-position分支归档，下一轮先读取[交接](../../docs/collaboration/MERMAID-POSITION-HANDOFF.md)。

## 已实现

实际画布接收图元拖入、pointer移动、选择/Shift多选、按钮或Delete删除；位置注释随Y.Text保存和协作。常见模板内联链节点可部分删除；复杂语法失败关闭，不重建全图。官方SVG只作为无授权sandbox内容，父页原生按钮覆盖交互，不开放脚本或同源权限。位置作为本应用注释派生SVG；第三方Mermaid仅自动布局，不解释这些注释。

## PASSED

- `pnpm --filter @teamspace/web run test`：最终21/21，16.2秒；含链中删除保留其他节点/边、批量删除、复杂引用拒绝、位置去重/边界/不污染其他注释，既有测试保留。
- `pnpm --filter @teamspace/web exec tsc --noEmit --incremental false`：退出0。
- 新脚本`tests/browser/mermaid-position.spec.cjs`首轮0/1：SVG能显示，但DOM节点ID含collabMermaidN前缀，覆盖层未识别。实际DOM诊断定位后修正，不删交互断言。
- 修正前缀后1/1通过、52秒：实际450/350拖入、515/405移动、三客户端同步/Viewer拒绝、刷新位置、部分/多选删除和SVG下载。.test-runs/mermaid-position-local-prefix/.last-run.json为passed。
- 增加已连接节点移动后路径重绘断言、按节点形状大小生成命中区后，再跑1/1通过、4.8分钟；结果.test-runs/mermaid-position-local-edges/.last-run.json为passed、failedTests为空。合成文档cff09e27-2568-4a41-8b98-7a1be4257ed7，最终保留A[Keep]与C[Retain]、A位置138/255；截图mermaid-position-local.png。两次浏览器是同一业务场景的逐步扩展，不相加为两个独立业务场景。
- 无真实模型、邮件或云供应商调用，无生产迁移/发布。

## NOT_RUN / 待修复边界

缩放后的准确拖放、空画布第一图元、撤销/重做、旧Mermaid多类型/业务图表回归尚未完成。自环、平行线、特殊自定义边ID、subgraph边界和复杂外形的连线/标签不能凭普通矩形/菱形测试宣称通过；必须补正确实现或在移动前明确拒绝，不允许悄悄错画。检查远端并发移动冲突与源码上限恢复。

生产构建、现有Vercel站点发布、正式域名交互验证均NOT_RUN。线上仍是r08按钮整理版本，不包含此次Mermaid改动。服务器资源检查与最终代码归档需在发布阶段更新。

## 接力

5小时剩余9%时依用户要求创建北京时间2026-10-26 00:42、05:44两个一次性任务；稍后查询剩余6%。任务ID collabspace-mermaid-00-42、collabspace-mermaid-05-44，均已工具确认ACTIVE/COUNT=1，不创建额外独立聊天。接力先核对当前分支/交接，完成则不重复开发或部署并删除自己。
