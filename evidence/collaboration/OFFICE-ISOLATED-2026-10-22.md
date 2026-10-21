# Office 社区版隔离验证

2026-10-22，独立开发服务，仅合成身份/测试文件，私有 SSH 转发访问。不是生产 CollabSpace Office 集成验收。

固定引擎：`onlyoffice/documentserver@sha256:ca17889f10b11141cc6441836aebdd2835cf3e1b49681b2fd6e155c94b7850b3`，编辑器报告 10.0.0 构建。

## PASSED

- 三种格式均使用 Alice、Bob 两个原生编辑器会话和一个 Viewer；服务端签名引擎回调报告两个真实编辑者；Viewer 请求保存被拒绝。
- Word 原生编辑、检查点与最后关闭保存，最终 revision=4；最新两段 Alice/Bob 完整标记均在下载文件内。Microsoft Word COM 读取确认双方文本、一个表格与一个内嵌图片。Word 清理 Quit 曾报告 RPC 错误，内容检查已经完成，不把进程清理错误隐去。
- Excel 分别修改 C4/D4，检查点及关闭后 revision=2；openpyxl 与 Microsoft Excel 均确认两格完整标记、两个工作表及原公式。Excel 实际计算 SUM(A2:A3)=5。
- PowerPoint 两个用户修改文本框，检查点与关闭后 revision=2；python-pptx 与 Microsoft PowerPoint 均确认双方完整文本和两个幻灯片。
- `python -m unittest discover -s tests/office-dev -p test_harness.py -v`：5/5，覆盖签名/过期、同会话 key/只读/能力范围、SSRF 拒绝、OOXML 类型与宏拒绝、重复回调/乱序检查点/旧会话保存栅栏。

## 发现并保留的问题

首次 Word 快速键盘输入时，下载文件中的标记缺失前几个字符，保存请求成功不能代表内容正确。调整自动化在换行后等待原生输入就绪并放慢逐键输入后，完整标记检查通过。未证明所有网络与快速输入场景无问题，后续仍需快输/输入法/断线样本。

Python docx 仅统计直接 inline_shapes 时返回 0，Microsoft Word 实际读到 1 个图片。不得据此删除图片或只依赖解析库数量判断 Office 兼容性。

## NOT_RUN / 未交付

生产文件入口及现有身份、租户、项目权限集成；实际撤权断开；跨租户 HTTP/Office 引擎拒绝；断线并发与保存失败恢复；可视排版逐页比较；真实用户长期使用；全部 Office 高级格式。当前只验证选定样本的文本/结构/公式，不声称完整 Office 兼容。

脚本：`tests/office-dev/office-browser.cjs word|sheet|slides`，私有配置放忽略目录 `.test-runs/office/config.json`，凭据不入库。原始合成文件与本次下载保留在忽略测试目录供复查。
