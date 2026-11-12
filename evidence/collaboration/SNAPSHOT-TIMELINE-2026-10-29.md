# 快照时间轴验收 — 2026-10-29

范围：P/BR/D/AT-SNAP，docs/collaboration/SNAPSHOT-TIMELINE.md。本轮仅本地实现与验证，未生产发布。

## 环境与命令

沿用独立合成环境 .test-runs/feature-audit-20261029/config.json（不输出配置值），PostgreSQL 15570、Web 14430、API 14431、原生文档 WS 14432。测试以非特权应用角色运行 Store；管理连接仅迁移、构造旧时间节点与分页样本。原有业务数据库未更换或清理。

- PASSED：注入上述合成配置执行 `node packages/collab-store/migrate.cjs`，增量迁移完成。
- PASSED：同配置执行 `node --test --test-concurrency=1 packages/collab-store/tests/timeline.test.cjs packages/collab-store/tests/integration.test.cjs packages/collab-store/tests/board.test.cjs packages/collab-store/tests/markdown.test.cjs apps/collab/tests/server.test.cjs`，14/14，零跳过。包含真实 DB、FORCE RLS、WS 提交 ACK/重启/提交失败、白板与Markdown回归。
- PASSED：新增 timeline 测试验证首次自动采样、分钟节流、重复回执不增节点、批量最终状态、旧快照不变、命名版本兼容、106个节点按游标翻页无遗漏、恢复早期正文且副本私有、Viewer恢复拒绝、撤权后历史拒绝。
- PASSED：`node node_modules/@nestjs/cli/bin/nest.js build`（apps/api），API 编译 exit0。
- PASSED：`node apps/web/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json`，exit0。
- PASSED：`node --test apps/web/tests/display-date.test.cjs`，2/2，日期与秒级快照时间跨UTC午夜均使用上海时区。

## 浏览器验证

真实本地应用、真实登录/API/DB/WS，tests/browser/timeline.spec.cjs。首次文档冷编译283.7秒，300秒测试预算耗尽，未完成操作，不计通过；失败trace保留于首次输出。复跑1/1 PASSED，3.3分钟，文档编译162.7秒；用键盘Home选择最早节点，断言早期正文不含最终修改，前后导航验证两份实际内容，立即保留后DB节点增加，恢复跳转独立副本。

本轮以Node22运行 `.test-runs/run-timeline-ui.cjs` 启动隔离API/WS/Web，再执行 `node node_modules/@playwright/test/cli.js test tests/browser/timeline.spec.cjs --reporter=list --output=.test-runs/timeline-browser`；需设置 COLLAB_BROWSER_CONFIG 指向上述合成配置。启动本轮专用原生Windows Redis 6399（无持久化），覆盖此前失效的本地Redis连接；不证明Redis生产能力。UI截图 `.test-runs/timeline-preview.png` 已目视检查，秒级上海时间、时间轴及只读正文清晰，无遮挡。开发服务仍打印已有Yjs重复导入警告，本轮实际内容同步和恢复断言均通过，未把警告消除列入本功能范围。

## 边界与上线

自动节点为成功编辑时的分钟采样，不是每次操作录制，不补造之前的历史。最后一次修改可使用“立即保留快照”固定。空闲不生成节点，恢复为新副本，不覆盖当前文档。Office不纳入Yjs快照，未跑生产容量或长期存储测试。

数据库需先迁移，API/WS再更新，最后前端。回退保留快照及新增列，旧应用须保留显式列名INSERT兼容补丁。Redis仅为本地API依赖，不作为正文或快照事实源。

收尾：最终Web类型检查与git diff --check exit0。仅移除本轮Next自动加入的 `.next-timeline/types` 配置，保留原有tsconfig修改；测试API/WS/Web进程树关闭，PostgreSQL精确测试目录fast stop、Redis6399 shutdown nosave成功。15570/14430/14431/14432/6399均确认无监听，合成数据库与截图保留。
