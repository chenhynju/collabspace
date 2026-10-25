# Mermaid 实际画布定位与部分删除：开发及发布记录

2026-10-26续做：源码eb7966f已部署至现有正式站点，API与数据库未修改。下方10月25日内容为历史开发记录；本次最终验收与发布身份见末尾追加节。

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

## 2026-10-26续做：实现与本地证据

- 位置恢复直接解析源码注释，重绘尚未完成时也能生效；清除过期交互层，pointer取消恢复原位置；超出32000字符的图形操作明确拒绝。侧栏改称节点列表，实际投放在右侧画布；连线用明确点选入口。
- 反向连线分开走弧线，按官方SVG中edgeLabel/label结构更新标签，保留箭头；自环、同向平行边、subgraph及自定义边自由定位明确拒绝，原源码不变。恢复自动布局可清除位置注释。普通模板/思维图仍保留原有编辑路径，不声明全语法自由编辑。
- Web单测最终22/22通过；新增安全拒绝测试首次失败是测试VM默认ES5未遍历matchAll迭代器，改为与应用一致的ES2020后9项定向、22项完整测试通过。没有移除安全断言。
- 24个模板实际逐个官方渲染、持久保存、重开通过；节点属性、复制/删除、标注连线、过期模板保护、导入、SVG/PNG导出用例也通过：.test-runs/mermaid-relay-ready前2项通过。图片保存为mermaid-relay-local-business-*.png；旧business-diagrams-online-*.png恢复原历史版本，避免把本地图冒充正式图。
- .test-runs/mermaid-relay-release-gate前3项通过：画布三客户端场景、50%缩放/空画布/撤销重做/恢复布局/拒绝复杂移动、原有多类型/离线/并发/输入法冲突/诊断/源码下载回归。该组历史恢复最终超时，不计通过。
- 本地最初API未就绪导致ECONNREFUSED；启动仅绑定127.0.0.1的已安装Redis 5.0.14.1后继续。另有创建请求失败未记录状态码、重绘热编译导致页面空白及测试超时，均未计通过。开发日志显示一次热编译469.6秒，不用提高测试时限掩盖。
- 本地生产构建实际完成38页、编译/类型检查通过，日志.test-runs/agent-runtime/mermaid-relay-production-build.log；存在既有lint警告。pnpm运行时曾触发8分钟锁文件策略核验，package.json/锁文件未改变；该命令退出0不单独算类型证据。

## BLOCKED：本地生产验收服务

本地生产构建后，自动审批规则拒绝启动next start；再将监听限制为127.0.0.1仍拒绝，返回仅为blocked by policy，没有具体理由。未通过改壳或其他本地进程绕过；本地生产浏览器验收NOT_RUN。沿用用户已明确授权的现有站点部署与上线后验收流程，保留旧部署回退，在正式域名补验。测试PG/API/Redis与临时inspector均已关闭，未动其他用户进程。

## 正式发布身份

- 应用源码eb7966f，前端r20261026-01；126文件快照SHA256 d5b52e94b06767fd6f3cb756b0d7f2cab137ae0454771335437d3947892909d7。
- Vercel dpl_49sw1YognkLsUSiUkcpNt1ofFUCj，https://collabspace-3y6haough-purelamp.vercel.app；独立构建52秒，inspect Ready后promote成功。回退为发布前实际核对的dpl_AxnSU8GDEsCtBvPZsQgnrVBotoMv。
- 全局Node环境在续做期间变为24.22.1，部署与正式验收使用现存Node22.20.0/Vercel59.23.2绝对路径，没有更改全局nvm。没有申请额外付费资源。
- 正式API保持r06及sha256:fd64a9f00b066bda9c828c47c543ae7860dcf44cdf35f8fb492992661ee104a8；不重启API，不做数据库迁移。WS/Office保持。
- 北京时间02:07服务器抽样：MemAvailable1698MiB，API75.57MiB/384MiB、CPU0.12%、OOM=false/restart0；磁盘8.8GiB/85%，load0.40/0.59/0.62，DB/Redis up、Office=true。不触发43.130.127.57迁移条件。

## 正式验收

使用私有合成账号配置、既有本机代理及显式MERMAID_POSITION_ONLINE=1，在实际域名运行mermaid-position.spec.cjs和mermaid.spec.cjs。结果在本节按实际结束状态追加；若正式验收失败则回退，不把上线本身当作通过。

**正式4/4通过，3.6分钟**，`.test-runs/mermaid-production-online/.last-run.json`为passed、failedTests为空。实际Node22.20.0/Edge、正式前端与正式API，不替换接口或模型。

1. 三客户端画布：450/350拖入、515/405移动、已连接节点移动与边路径更新、双编辑同步/刷新、删除模板链中节点保留其余边、Shift多删、Viewer禁用、SVG下载。
2. 空白画布50%坐标换算、撤销/重做、恢复自动布局、自环移动拒绝且源图不变、iframe仍无授权sandbox；反向边分开走弧线，标签位置不同且文字保留；32000字符上限拒绝新增，完整源码哈希不变。
3. 原有流程/思维图关系编辑、六类官方图表、多账号并发、离线回连、刷新、输入法远端冲突保留草稿、语法错误保存、禁用配置/外部资源、.mmd下载与视图切换通过。
4. 带位置注释的历史只读预览、恢复为新私有副本后源码完整保留；原协作者请求副本404。生产包没有复现开发热编译空白页。

额外创建中文演示白板并实际保存、渲染，记录在mermaid-online-demo.json/png：[打开演示](https://collabspace.purelamp.uk/projects/cmvg1shjj001w55oco1ou87o3/documents/f4752774-d481-49a8-a5f9-f84c6870de05)。owner可编辑，member为EDITOR、admin为VIEWER。零模型调用、零邮件外发。

03:09北京时间复核：可用内存1672MiB、磁盘8.9GiB/85%、load0.87/0.84/0.76；API76.71MiB/384MiB、CPU0.13%、OOM=false/restart0；DB/Redis up、Office=true。无需迁移。此为抽样，不是压测或长期容量保证。

## 发布边界与归档

完成本次普通流程图的实际拖放/保存/局部删除及复杂结构安全拒绝，不宣称任意Mermaid语法完整几何编辑。Safari/Firefox/移动触屏与无限画布、任意复杂边/分组自由定位未验收。自动审批阻塞的本地生产服务启动仍单列BLOCKED，不因正式验收通过而改写其结果。

源码eb7966f，后续文档/证据归档至主分支与标签collabspace-20261026-mermaid；压缩包与SHA256清单在.test-runs/archives。未纳入私有.env、依赖、测试数据库及另行出现的未跟踪reports/、.trae-html-share-packages/。两次接力任务在完成后清理，避免05:44重复执行。
