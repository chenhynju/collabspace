# Mermaid 画布连接点拖线验收

2026-10-26，用户要求普通图元自由移动、画布直接连线。基线64423ab，应用源码3e64a1d；没有后端或数据库变更。

## 实现与契约

蓝色连接点pointer capture，拖到目标节点创建单向/双向/无箭头、虚线或粗线，支持文字。落空、Esc、pointer cancel取消。创建连线时把当前节点坐标写入原Y.Text位置注释，避免新增边引起自动布局移动。沿用原快照并发检查、ACL、持久化ACK、撤销和版本；不放宽iframe sandbox。已定位图中的自环、同向平行边、分组和自定义边仍安全拒绝。

## PASSED

- Web单元测试23/23（覆盖五种连线样式、位置注释保留和非法标签拒绝）；TypeScript noEmit退出0。首次误用根目录typescript路径缺模块，改用apps/web的实际安装路径后通过。
- 本地Next生产构建38页，日志.test-runs/mermaid-connect-build.log；既有lint警告保留。
- 发布前服务器04:34北京时间：可用内存1680MiB、磁盘8.9GiB/85%、API75.87MiB/384MiB、CPU0.13%、OOM=false、restart0、DB/Redis up。无迁移需要。

## 正式验收范围

真实鼠标连接点拖线、50%缩放、Esc、样式文字、现有位置保留、双编辑ACK、刷新、撤销重做、重复方向拒绝、Viewer无连接点，及原Mermaid回归。实际结果见下节。

## NOT_RUN

Safari/Firefox、移动触屏、任意复杂Mermaid源码自由几何编辑。旧本地生产服务启动审批阻塞见前次报告；本轮未重新启动该服务。没有真实邮件/模型调用，没有付费资源开通。

## 发布身份

前端r20261026-02，应用源码3e64a1d，126文件快照SHA256 8c64e6cc9221e345ded49ee3b2d404197d20db4b713cd234d5afdefbb45d929d。
Vercel dpl_9ApApzADSftDrMha8xKY55dovWXg，https://collabspace-n72hltf1q-purelamp.vercel.app；构建2分22秒，inspect Ready后promote成功。回退为前次r01 dpl_49sw1YognkLsUSiUkcpNt1ofFUCj。
API镜像fd64a9f保持，未重启API/WS/Office，不做数据库迁移。04:40抽样：可用1654MiB、磁盘8.9GiB/85%、API76.54MiB/384MiB、CPU4.71%、OOM=false/restart0，DB/Redis up。此为验收期间抽样，非长期压测。

## 验收过程

第一次线上脚本在纯图形视图读取已卸载的本页源码textarea，等待未完成；已按进程归属结束该次测试，未计通过。改读第二位编辑者的真实源码并保留全部断言，重新执行完整4项。
最终运行目录.test-runs/mermaid-connect-online-final，日志.test-runs/mermaid-connect-online-final.log。第一项已通过（1.6分钟），合成文档f32c9565-2e77-4395-86e0-4a0e24e9c4ad：实际连接点拖线、空白/Esc取消、自连拒绝、50%缩放带文字虚线、坐标保留、双编辑保存/刷新、撤销重做、重复方向拒绝、移动边跟随、局部删除/多删、Viewer无连接点、SVG导出。

## 最终结果：PASSED

正式4/4通过，共4.7分钟；.last-run.json status=passed、failedTests=[]。第二项25.4秒：空画布缩放/撤销重做/自动布局/自环拒绝/反向边标签/源码上限；第三项2.1分钟：官方多类型、双编辑、只读、离线、诊断、安全拒绝及重载；第四项28.3秒：定位历史预览和新私有副本恢复，原协作者不能访问副本。

既有中文演示白板只读检查通过：4个连接点、官方SVG与中文节点渲染，截图mermaid-connect-online-demo.png已人工视觉检查。演示：https://collabspace.purelamp.uk/projects/cmvg1shjj001w55oco1ou87o3/documents/f4752774-d481-49a8-a5f9-f84c6870de05。

运行命令：`node --test apps/web/tests/*.test.cjs`（23/23）；`node apps/web/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json`；在apps/web使用NEXT_DIST_DIR=.next-mermaid-connect执行实际next build（38页）。正式浏览器使用既有私有COLLAB_BROWSER_CONFIG、COLLAB_ACCEPTANCE_PROXY和MERMAID_POSITION_ONLINE=1执行`node node_modules/@playwright/test/cli.js test tests/browser/mermaid-position.spec.cjs tests/browser/mermaid.spec.cjs --config playwright.config.cjs --reporter=list --output=.test-runs/mermaid-connect-online-final`。实际Node22.20.0绝对路径，未修改全局环境。

## 归档

应用3e64a1d；补充测试和证据随主分支归档，标签collabspace-20261026-mermaid-connect，Git压缩包及SHA256在.test-runs/archives。未提交私有凭据/测试数据库/依赖。此前接力已删除，本轮无需新增定时任务；收尾时5小时剩余16%，未触发10%条件。
