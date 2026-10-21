# 原生 Markdown 协作实现（2026-10-22）

新增文档种类 MARKDOWN，权威内容为独立 Y.Text("markdown")；不复用白板 mermaid 根，不将富文本快捷输入冒充文件源码。采用现有组织、项目 ACL、文档授权、持久 ACK、IndexedDB、离线 pending、评论和版本恢复路径。

项目文档页可新建 Markdown 或导入 UTF-8 .md；BOM 去除，CRLF/CR 转 LF，限制 64000 字符和 200000 UTF-8 字节，拒绝 NUL 与非文本根/嵌入对象。文件列表可打开已授权的 Markdown；列表候选也逐项重新检查访问权限。导出真实 .md，离线可导出本地源码。

安全预览使用 react-markdown/remark-gfm，忽略原始 HTML，外部图片不请求，危险链接不开放；Mermaid fenced code 使用现有受限渲染器。源码使用现有相对位置、IME 与本地撤销机制，并显示协作者行列位置。历史只读预览和私有恢复副本保留源码，恢复生成新的 Yjs 内容身份。

## 兼容发布顺序

新增兼容 SQL `packages/collab-store/migrations/20261022-markdown.sql` 扩展文档种类约束。先备份，再执行迁移及更新 API/WS，最后更新前端。新前端发送 docSchema=3；新服务继续接受旧富文档 schema=2，Markdown 必须 schema=3，避免旧客户端误编辑。

回滚前端时保留能识别 Markdown 的服务端及数据库约束，不能让旧富文本编辑器打开 Markdown。数据迁移不删除旧文档；不能自动删掉新类型内容来恢复旧 CHECK。

## 当前验证边界

本地真实 PG/WS 28/28、Web 单元 7/7、API 与 Windows Web 构建通过。完整 Markdown 浏览器流程通过，包含导入、全局文件入口、三个角色、双编辑者收敛、离线编辑导出及重连、实时评论、版本预览、私有恢复、刷新与副本隔离。既有文档/IM/Mermaid/图文/跨租户浏览器 5/5。线上发布和线上 Markdown 验收尚未执行；Office 另行隔离验证。
