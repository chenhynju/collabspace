# Mermaid 画布定位修复交接

2026-10-26后续直接连线已完成：应用3e64a1d，r20261026-02，Vercel dpl_9ApApzADSftDrMha8xKY55dovWXg，正式4/4、Web23/23、生产构建38页通过。见[拖线验收](../../evidence/collaboration/MERMAID-CONNECT-2026-10-26.md)，标签collabspace-20261026-mermaid-connect。下文r01为前次发布，可回退。

## 已完成：2026-10-26正式发布

本次接力已完成，勿重复启动。应用源码eb7966f，Vercel dpl_49sw1YognkLsUSiUkcpNt1ofFUCj，r20261026-01；正式4/4通过（3.6分钟），本地Web22项、38页生产构建通过。详见../../evidence/collaboration/MERMAID-POSITION-2026-10-25.md，中文演示链接在报告中。API/数据库未改；原r08部署保留回退。最终归档标签collabspace-20261026-mermaid。下面是历史交接资料，不是仍待执行清单。

本地生产服务启动被自动审批拒绝，未绕过；通过既有授权的正式发布/验收流程完成。测试PG、API、Redis、inspector均已关闭。未跟踪reports/和.trae-html-share-packages/不是本轮工作，保留不纳入归档。若定时任务仍触发，只核对完成标记并删除自身；05:44任务已无需继续。


2026-10-25，用户反馈不能把图元拖入实际画布、位置不能自由调整、不能部分删除。基线14c2779，本轮未发布代码归档在codex/mermaid-canvas-position分支；不要把开发分支当成上线。先git status/diff，勿覆盖其他工作。定时接力已创建：北京时间10月26日00:42、05:44，仅各一次；automation id分别collabspace-mermaid-00-42、collabspace-mermaid-05-44。创建时5小时剩余9%。如果本轮已完成并归档，不重复执行。

## 根因与实现

- 原MermaidComposer只有侧栏节点列表，拖动只建关系；iframe为只读预览；原deleteFlowNode只支持独立生成节点。
- 新mermaid-position.ts把位置写成`%% collab-position ID x y`注释，沿用Y.Text、ACL、ACK、撤销和历史，无新根或数据库变更。
- MermaidPreview接收writable/commit/selectedIds/onSelect，在无授权sandbox外覆盖原生按钮；拖入增加、pointer移动、Shift多选、按钮/Delete删除。MermaidWorkspace连接共享编辑；侧栏选择联动。
- mermaid-svg-layout.ts只用DOMParser解析官方生成SVG，不在父页挂载SVG、不放开sandbox，移动节点并调整常见边路径，导出使用同一派生SVG。官方实际ID含collabMermaidN前缀，已修正节点和边ID匹配。
- deleteFlowNodes支持常见内联/独立节点与链式连线，删除节点时保留其余节点/边/注释；复杂批量语法或按序号linkStyle拒绝，不做有损重建。原有mindmap关系操作保留；自由坐标交互目前针对flowchart，不宣称所有Mermaid类型。

## 已验证

- Web单测20/20通过（新增链中删除、多删、保留注释/引用，旧严格删除断言按新需求更新）；tsc退出0。
- 首轮新浏览器失败：SVG显示但覆盖按钮缺失；实际ID带渲染器前缀，修正后新脚本mermaid-position.spec.cjs **1/1通过，52秒**。真实3客户端、实际画布450/350拖入、移动至515/405、双编辑共享、刷新保持、模板中间节点删除、Shift多删、Viewer只读/按钮禁用、SVG下载通过。结果.test-runs/mermaid-position-local-prefix/.last-run.json，截图evidence/collaboration/mermaid-position-local.png。合成文档3e676f6c-9281-415d-b551-40d90e05cf75。

## 尚需完成（不得提前报完成或发布）

追加进展：最终单测21/21、tsc退出0；边线移动/按外形大小命中区追加后，浏览器1/1通过（4.8分钟），.test-runs/mermaid-position-local-edges/.last-run.json为passed，文档cff09e27-2568-4a41-8b98-7a1be4257ed7。详细分层证据见../../evidence/collaboration/MERMAID-POSITION-2026-10-25.md。仍需自环/平行/自定义边ID/subgraph/特殊形状安全边界和下面未测项；不能拿普通路径跟随证明所有边正确。

1. 浏览器追加连线随已连接节点移动的实际SVG端点/箭头/标签验证、缩放坐标、空画布拖入、Undo/Redo与复杂引用拒绝/原图保留；位置工具单测。检查特殊图元命中区域、群组/自环/平行边等安全边界，不能悄悄画错。
2. 必要修复后跑类型、Web测试和Mermaid/业务图表有关回归；原有24模板不一定全量重跑，但官方渲染/源码/sandbox/导出与旧关系编辑要有针对性证据。
3. 同步MERMAID.md、BUSINESS-DIAGRAMS.md、REQUIREMENTS/DESIGN/IMPLEMENTATION_PROMPT，明确位置为应用注释、外部Mermaid只自动布局；不承诺全语法自由几何编辑。
4. 通过后仅发布前端，复用prepare-voice-web.cjs，选未使用的r20261025-09或按实际日期命名；Vercel inspect Ready才promote。现线上仍r08 dc91ac3，API r06 fd64a9f不动。正式浏览器显式MERMAID_POSITION_ONLINE=1，真实模型/邮件不调用。
5. 更新验收报告、提交/标签/Git压缩包与SHA256，推送并核对远端；若完成后接力触发仅核对完成标记并删除自己。

## 环境与操作

本地测试服务本轮已按归属核对后关闭，数据库和证据保留。续跑使用scripts/local-up.cjs：COLLAB_LOCAL_NAME=voice-persona-final，DB15449/Web14320/API14321/WS14322，COLLAB_LOCAL_SKIP_GENERATE=1、COLLAB_LOCAL_SKIP_SCHEMA_PUSH=1，Azure/DeepSeek环境变量置空；合成配置.test-runs/voice-persona-final/config.json。设置COLLAB_BROWSER_CONFIG后用tests/browser/config.cjs合并默认邮箱/密码，不能直接读取原JSON当完整账号配置。后者不含邮箱；曾导致诊断脚本登录失败，非产品故障。没有Azure/DeepSeek本地调用。

关闭时先验证pgdata绝对路径在本项目.test-runs/voice-persona-final/pgdata、postgres父进程为本次scripts/local-up.cjs，然后pg_ctl fast stop，再仅结束该父进程树；保留数据库。停服务后移除Next自动写入tsconfig的.next-voice-persona-final/types包含项。Redis6399与invitation_sync_inbox仍是旧环境缺项，不计其验收。

上线配置.test-runs/deploy/online-config.json为私有合成账号，勿提交或输出密钥。已授权CLI/浏览器/本地文件和现有站点发布，不用再问。现有HTTP代理http://127.0.0.1:6382供本次Vercel/Playwright/Git用，不改全局设置。Git用`git -c http.proxy=http://127.0.0.1:6382 ...`；Vercel临时HTTPS_PROXY。服务器170.106.161.82，密钥C:/Users/chenh/.ssh/toolkit_deploy，ProxyCommand=node D:/appspace/collaboration/.test-runs/deploy/ssh-http-proxy.cjs，StrictHostKeyChecking=yes；可只读运行/opt/collabspace/shared/agent-voice-release.sh verify。资源不足才考虑43.130.127.57。
