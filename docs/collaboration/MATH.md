# 数学公式输入（2026-10-24）

## P-MATH / BR-MATH

原生富文本文档支持公式模板拖到正文位置、点击插入及手写 LaTeX；选中已有公式后打开“数学公式”可修改源码。模板复用自 portfolio-site 的 FormulaPalette（只读源工程），覆盖三角、微积分、线性代数、概率和希腊字母。公式按块展示，采用 KaTeX 支持的语法，不执行完整 TeX 文档或外部命令。Markdown、白板、Office 本轮不新增公式编辑器。

## D-MATH

- Tiptap `documentFormula` 原子块仅保存 latex；KaTeX 在客户端派生显示，trust=false、maxExpand=200、maxSize=20，源码最多 8000 字符。
- 模板 application/x-latex 拖放到正文坐标；点击在当前选区插入。输入无效时保留草稿、显示错误、不写正文。块可选中、移动、删除，纯文本导出保留 $$ 源码。
- 正文沿用现有 Yjs、本地缓存、服务端持久化 ACK、文档 ACL、版本与私有恢复，不新增 API/数据库表。只读角色禁止公式写入，服务端仍逐条授权。
- docSchema=4；同步服务拒绝富文本文档的旧 schema 2/3，防止旧编辑器归一化时删除公式。Markdown 保持兼容 3/4，白板沿用既有协议。上线需协调 Web 和 collab 服务升级；旧标签页需刷新。
- 历史只读预览注册相同公式节点；渲染异常显示错误而不删除源码。

## AT-MATH

1. 模板点击与拖放到正文均得到公式，可修改源码；无效源码明确拒绝。
2. 矩阵/积分/所有模板可渲染；不可信命令不生成可执行链接。
3. 两份 Y.Doc 同步、更新和新 lineage 重建保留源码。
4. 真实隔离数据库保存/版本/恢复保留公式，Viewer 写入拒绝、恢复副本不向旧 Viewer 公开。
5. 旧富文本客户端被拒绝，当前客户端及已有同步/故障恢复回归通过；只读界面禁止操作。

## 运行

`pnpm --filter @teamspace/web test`；`pnpm --filter @teamspace/web exec tsc --noEmit`；`pnpm test:collab`（需要本机隔离测试数据库配置）。依赖 katex 0.18.11 已在现有 lockfile 中由 Mermaid 引入，本轮提升为 Web 直接依赖。

验证结果见 evidence/collaboration/MATH-2026-10-24.md。
