# 协作空间统一文档入口：正式域名验收

2026-10-28用户要求合并富文本/Markdown入口、点击类型后无需再次选择即可打开编辑器。契约见docs/collaboration/HUB-DIRECT-OPEN.md。本次仅前端更新，无API重启或数据库变更。

## 已发布行为

- 统一“文档”入口和筛选，包含DOCUMENT/MARKDOWN；既有Markdown按原kind进入源码编辑器，富文本进入富文本编辑器，不转换Yjs数据。
- 项目内点类型卡片直接创建未命名内容并进入对应编辑页；名称可在编辑器重命名。全局未选项目且有多个项目时使用项目按钮，一次选定后直接打开，不默认选任意项目。
- Word/Excel/PowerPoint直达Office页面，后缀/项目/幂等意图正确；双击防重、未知网络结果禁止再次新建，先刷新列表核对。顶部通用“新建”保留可自定义名称的流程，类型卡片走快捷流程。

## 发布与验证

- 应用源码de082c04ee3f5947d2cb01cd55bfaee6a32e5d36；Vercel生产部署dpl_5spsPt4k1AiWkxir67ecY8pWF8Zp，https://collabspace-mg9scybdw-purelamp.vercel.app，已promote至https://collabspace.purelamp.uk。
- 上一前端https://collabspace-a4iz2koyf-purelamp.vercel.app保留可回退；API仍为r20261028-01/e5bbfc70a1c9，未随此次前端发布重建。
- PASSED：本地交互fixture 8/8；新增顶部未知结果防重1/1；Web单元26/26；生产构建38/38页面成功。fixture仅验证交互/请求，不代表真实后端。
- PASSED：正式域名Word、Excel、PowerPoint直达各1项；富文本直达/重命名、统一筛选、既有Markdown原文一致1项，共4项真实流程通过。
- 保留失败边界：首次fixture 5过2失败，编辑路由冷编译等待与Next播报器导致定位器冲突，预热/精确定位后8过；首次线上3过1失败，测试直接重命名漏传revision，被服务器拒绝，改用真实UI重命名（携带revision）后通过，未放宽服务端并发规则。
- 合成验收资源位于专用测试项目：富文本6ee042a8-b9ea-4b52-b872-986190739f60、Markdown b8b20d93-5df4-445e-9856-9d3b3ad0bfe9；Office三种文件标识见线上测试日志。保留合成文档供追溯，未修改用户文档；本轮未验证Office内完整编辑/保存周期。

截图hub-unified-online-20261028.png和hub-markdown-direct-online-20261028.png；本地证据hub-direct-fixture-20261028.txt、hub-direct-guard-20261028.txt、hub-direct-web-unit-20261028.tap。未把缺供应商的语音/真人/支付功能写作本轮通过；剩余清单见docs/collaboration/CURRENT-STATUS-2026-10-28.md。

只归档本次和上一阶段明确所属改动。工作树中另有RTC交接/relay文件，未纳入、覆盖或删除。
