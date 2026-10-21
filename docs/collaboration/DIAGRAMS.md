# Diagram workspace — flowcharts and mind maps

2026-10-21 最新决定：白板图表以 Mermaid 源码为主要执行标准；本文件的基础导入/导出说明仅适用于保留的自由画布。官方渲染、共享源码、双视图及后续图形回写边界以 [MERMAID.md](MERMAID.md) 为准。

The collaborative whiteboard is being extended into an editable diagram workspace. References: [draw.io connectors](https://www.drawio.com/docs/manual/connectors/), [Mermaid flowcharts](https://mermaid.js.org/syntax/flowchart.html), [Mermaid mind maps](https://mermaid.js.org/syntax/mindmap.html). These are interaction and interchange references, not a claim of file-format or feature parity.

## Product contract

- Flowcharts: rectangle, ellipse and decision diamond; node-bound labeled connectors with straight, orthogonal or curved paths. Endpoint geometry follows node movement/resize, including local drag preview. Templates are additive. Grid snapping is optional. Double click focuses the text property editor.
- Mind maps: root, child and sibling topics; Tab/Enter when the canvas is focused; explicit deterministic tree layout; parent connections rendered from current geometry. Deleting a parent keeps child content as orphan roots. This prevents implicit loss of a collaborator's branch; it is not recursive deletion.
- Mermaid source: bounded basic flowchart LR/TD/TB and indentation-based mindmap. Parse and preview entirely before an explicit additive CRDT commit. Unsupported syntax fails visibly and cannot partially mutate the shared board. Export preserves text/topology, not coordinates/styles. No subgraph, arbitrary Mermaid directives, HTML, links, plugins or code execution. Standalone legacy arrows cannot be exported as graph edges without binding, so export refuses rather than silently omitting them.
- SVG export captures the visible document content without transient cursors/resize handles. JSON draft export remains available. No raw SVG/XML import.

## Model and safety

Optional properties extend the existing bounded shape schema: type diamond/mind/connector; parent UUID for a mind topic; atomic binding {from,to,style} for a connector. Existing objects remain valid. No database migration or parallel room service. Server validation rejects wrong property/type combinations, self-links, connector endpoints referring to other connectors, cyclic/non-mind parent chains, malformed UUIDs, excessive size and unsafe values. Missing endpoints after concurrent deletion are allowed but links are hidden; deleted content is not resurrected.

Each topic and connector stays a nested Y.Map in the same Y.Doc. Text/geometry/binding remain independently mergeable properties; atomic geometry/binding avoids mixed coordinates/endpoints. Same-property concurrency follows Yjs ordering. Layout is an explicit user edit under local UndoManager origin, not a server process continuously overriding collaborator movement. User undo excludes remote edits. A fresh version copy keeps intra-board references while cloning into a new CRDT lineage; ACL and revocation stay in the existing Store.

Backend schema support must ship before frontend support. Already-open old frontends need reload to render the new shape types; they do not replace the shared state. Preserve document collaboration, tenant isolation and durable commit-before-ACK tests.

## Acceptance

DG01: two editors and a viewer; import flowchart only after preview, bind/move nodes, verify live remote path updates and no viewer mutation.
DG02: create mind template/child/sibling, deterministic layout; concurrent remote edit plus offline branch, reconnect, own undo/redo, reload consistency.
DG03: invalid Mermaid does not mutate; Unicode/special label export/import retains semantics; bounded cycle handling; SVG file contains current text without transient UI.
DG04: existing document/board/version/tenant/ACK/revocation business journeys remain valid. Results and exact tested source belong in evidence, not inferred from this design.

## Deliberate boundaries

This is not full draw.io/Visio or full Mermaid compatibility. No .drawio/.vsdx import, custom waypoints/ports, obstacle-avoiding routing, layers, swimlanes, BPMN/UML libraries, arbitrary grouping, rich HTML labels or collapsible/reparentable mind branches yet. Basic layout may overlap on very large/deep diagrams; maximum 500 objects and original coordinate limits remain. No new capacity or multi-instance claim.

## 2026-10-21 图元库与拖动编辑（DG05）

新增 8 类有界 SVG 图元：文档、输入/输出、初始化、三角形、数据库、服务器、云服务、参与者。客户端图元库及服务端类型白名单共享 catalog 定义。支持原生 HTML 拖放到画布，也支持点击图元再点击画布；按当前平移/缩放矩阵换算落点，继续遵守可写权限及网格吸附。

新图元沿用拖动位置、右下角缩放、文字和配色；补充 X/Y/宽/高数字编辑（失焦或 Enter 提交）、普通图元类型转换和单图元复制。mind/connector 不可通过普通类型下拉改成非法树/绑定对象；连接线几何仍由端点派生。一次几何编辑作为原子字段提交，复制保留属性但使用新 UUID，撤销/重做继续只跟踪本机 origin。

复杂图元连接线目前以外接矩形作为锚点包络；矩形/椭圆/菱形保留已有轮廓计算，不宣称任意 SVG 轮廓的精确端口吸附。Mermaid 基础导出保留文字与拓扑，新图元外形会简化，界面已明确提示。没有新增外部 SVG/图片导入或任意脚本执行。

DG05：两个编辑账号与只读账号；全部 8 类原生拖放、修改属性/位置/大小/类型、复制撤销重做，另一端实时可见，刷新后仍一致。真实非特权 PG 验证所有新类型通过版本恢复副本保存且 Viewer 不得写。保留已有图解、文档、权限、离线与持久 ACK 回归。
