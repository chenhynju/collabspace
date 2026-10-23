# Figma 排版落地验收 — 2026-10-23

## 来源与范围

[Figma设计稿](https://www.figma.com/design/7IwWhVlznS5r8Q8xkU16VW)，工作台5:13、编辑器5:101；实现51961aabc07e56ae3addc41914da75a08a3f43f9。高保真设计上下文已读取，使用本地Tailwind/UI组件，不以截图实现界面，无外链临时Figma资源。两个画面的布局与主色落地，真实数据替代静态示例。

## 部署前结果

| 检查 | 状态 |
| --- | --- |
| Windows最终生产构建 .next-figma-release，36页 | PASSED |
| Web单元11/11 | PASSED |
| 最终构建三账号业务绘图：编辑者/只读、属性/连线/模板CAS/导入/持久化/SVG+PNG导出 | PASSED |
| 最终构建新流程：工作台真实新建、双账号源码收敛、在线评论、讨论收起/历史展开、SVG导出、最近搜索、390px导航 | PASSED |
| 最终本地浏览器合计2/2 | PASSED，1.2分钟 |
| 最终截图对照 | PASSED，画布上移，图元侧栏有独立滚动，源码与图形切换仍可用 |

首次完整流程运行在手机遮罩中心点击处超时：中心点位于抽屉覆盖区，前面的新建/同步/评论/导出/搜索已完成。改为验证现有Escape关闭路径后完整通过；保留失败日志，不伪报首次通过。再次对最终压缩工具区的发布构建完整跑2/2通过。

本地使用现有测试PG5548、Redis6399及独立API3001/WS3002/Web3108。无测试库reset，无生产存储操作；未修改任何已有用户文档。只创建合成测试资源。历史截图未作为本次验收，生成工具覆盖的历史截图将在证据归档时还原。

## 边界

最近编辑按现有项目/文件API获取，有权访问才显示；每项目最多100项，搜索为已加载元数据，非全文检索。普通文档API未返回最近作者，不伪造作者或动态。Office最近列表仅收录已初始化officeId的可见文件。默认保留源码分屏，图形模式可专注画布，非宣称任意Mermaid坐标可回写。

保留旧离线提示、语法限制、导入确认、只读控制，未按静态稿隐藏真实安全/错误状态。没有新增收藏、全站快捷键、假在线人数或示例讨论。无后端/数据库迁移。未声称本轮完成Office内部UI、全站手机兼容、性能/高可用验收。

## 正式发布与线上结果

Vercel dpl_3qRKwUyjHvVrS2JE8aykqVj3xzEo 已正式切换 collabspace.purelamp.uk。源提交51961aa；CI [39913054175](https://github.com/chenhynju/collabspace/actions/runs/39913054175) PASSED。旧前端dpl_7KonZXUKrCT7froYsRSAm2jeh3XW保留，后端/数据版本未修改。

PASSED：正式站点真实浏览器5/5，4.3分钟：三账号绘图1.0分钟、三账号文档/离线恢复1.3分钟、双账号IM39.9秒、桌面/390px导航15.3秒、新工作台完整创建/同步/实时评论/侧栏/导出/最近搜索/手机导航50.7秒。新流程合成文档c11e0118-16d3-4cda-a2c1-9f569329eb99，创建在授权演示项目下，不编辑用户原文档。

figma-editor-online.png、figma-hub-online.png、figma-mobile-online.png为最终线上截图，已查看版面、真实保存状态、成员与评论。历史验收截图保留原件。

命令：COLLAB_BROWSER_CONFIG指向私密线上配置，Playwright运行figma-layout/business-diagrams（shared案例）/documents/im/ui-refresh五项，--reporter=list、独立output目录。不将配置、口令、令牌和浏览器trace写入仓库。
