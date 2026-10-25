# Office 第一批产品增强验收

后续已按用户明确授权发布，正式域名端到端三格式验收见 [发布记录](RELEASE-2026-10-25.md)。以下NOT_RUN保留为最初开发验收当时状态，不代表最终发布结果。

范围：用户要求Word、Excel、PowerPoint均衡推进并力争原生Office 90%以上。新建 [能力基线与契约](../../docs/collaboration/OFFICE-PARITY.md)，本批实际实现重命名、已确认版本私有副本、已确认版本PDF导出与打印文件。**没有宣称完成全量90%，也没有把现有引擎菜单等同于业务验收。**

## 环境

独立合成本地 `office-product-1025`：PostgreSQL5571，Web43320、API43321、WS43322，运行角色teamspace_app无superuser/bypassrls。没有修改portfolio-site；保留原有tsconfig改动，清理本轮构建新增types目录项。未部署新版本、未迁移生产表、未真实发信，无LLM调用。

本地启动使用 `COLLAB_LOCAL_SKIP_GENERATE=1`、上述端口和 `COLLAB_LOCAL_NAME=office-product-1025` 后执行 `node scripts/local-up.cjs`。这是新建合成库，seed清空仅该库。Redis6399未启动、既有邀请投递表缺失产生背景日志；不据此声称整个本地系统健康。当前验收不调用邀请、IM或生产数据库。

## PASSED

| 项目 | 实际命令/结果 |
| --- | --- |
| API构建 | `pnpm --filter @teamspace/api run build` PASS |
| Web类型 | `pnpm --filter @teamspace/web exec tsc --noEmit` PASS |
| Web构建 | `NEXT_DIST_DIR=.next-office-product-1025 pnpm --filter @teamspace/web run build` PASS，38路由；仅既有register Hook和MessageBubble图片警告 |
| 原有Office生命周期+本轮真实PG | 按本地config设置COLLAB_TEST_DATABASE_URL及TEST_*后，`node --test packages/collab-store/tests/office.test.cjs packages/collab-store/tests/office-create.test.cjs packages/collab-store/tests/office-product.test.cjs`：8/8 PASS，0SKIP；原签名/包/SSRF、并发创建、关闭重开、失败提交恢复、共享key、撤权隔离、项目READ上限均通过 |
| 最终新增域规则 | `OFFICE_PRODUCT_CONFIG=.test-runs/office-product-1025/config.json node --test packages/collab-store/tests/office-product.test.cjs`：2/2 PASS；三格式改名双记录一致、不改变内容版本、名称冲突、旧通用入口拒绝、三并发副本幂等、内容字节相同、私有权限、PDF来源、跨组织拒绝、转换途中撤权、并发锁释放、错误格式/路径/UUID拒绝。此项转换供应商为明确替身 |
| 真实HTTP | `OFFICE_PRODUCT_HTTP_CONFIG=.test-runs/office-product-1025/config.json node --test apps/api/tests/office-product-http.test.cjs`：1/1 PASS，6.4秒；真实登录/组织guard、三格式改名、过期名称409、副本重放同ID、只读403、未登录401、伪造组织403和非法版本400 |
| 三格式浏览器组件 | `pnpm exec playwright test tests/browser/office-file-actions.spec.cjs --reporter=list --output=.test-runs/office-file-actions-browser-final`：3/3 PASS，59.3秒；实际React组件，API替身，改名、指定旧版本PDF下载、候选隐藏、副本模拟502后相同requestId重试、只读不见写动作 |
| 既有API专项 | `pnpm --filter @teamspace/api run test`：39项34PASS/5可选集成SKIP/0失败（执行时尚未添加本轮独立HTTP测试文件；该文件后续已单独真实运行通过） |

### 真实ONLYOFFICE 10转换

使用现有三份合成baseline，执行**本轮同一convertPdf实现**，通过现有API容器内独立Node诊断进程调用真实引擎 `/converter/from-file`。私密JWT仅从容器现有环境内存读取，不回传或入仓。没有部署代码、替换镜像或重启服务。调用有96MB Node堆约束，三份顺序执行。

| 输入 | 实际PDF字节 | pypdf页数 | 提取正文标记 |
| --- | ---: | ---: | --- |
| baseline.docx（段落、表格、图片） | 48030 | 1 | CollabSpace Word baseline：存在 |
| baseline.xlsx（SUM公式、两工作表） | 18577 | 1 | CollabSpace Excel baseline：存在 |
| baseline.pptx（文本、图片、两幻灯片） | 25622 | 2 | CollabSpace PowerPoint baseline：存在 |

PDF使用bundled Python/pypdf实际读取页面及提取文字，不把200/魔数当内容成绩。此验证不证明所有中文字体/版式、所有打印设置和动画兼容。私密文件 `.test-runs/office-product-real-pdf/{docx,xlsx,pptx}.pdf` 和 `checks.json`。

可复现核心调用为 `scripts/verify-office-pdf-engine.cjs`：明确设置 `OFFICE_PDF_ENGINE_TEST=1`、私密 `OFFICE_TEST_ENGINE_URL`、`OFFICE_TEST_JWT_SECRET`，仅上传固定合成baseline；不自动加载生产密钥。基线生成脚本 `tests/office-dev/create-fixtures.py`。

## 失败与修正

- 浏览器首轮about:blank环境缺少安全上下文UUID能力，副本调用未发出；换为localhost测试页后完整3/3通过。没有把首轮失败当通过，也没有因测试问题移除生产幂等保护。
- HTTP初轮按200断言登录，实际Nest POST登录返回201；根据实际接口修正后通过。
- 系统Python无pypdf，使用bundled运行时后实际解析通过；未临时安装线上依赖。

## NOT_RUN / 边界

- 新API/UI生产部署、正式域名端到端PDF下载、跨组织浏览器会话切换：NOT_RUN；构建/组件不代替发布。
- 浏览器组件API为替身；真实PG、HTTP鉴权和真实引擎转换分别已验，尚未在一个生产浏览器请求中贯通整条PDF链路。
- 本轮未重新运行原生Microsoft三应用完整往返及全部60项内容/版式样本；以前的Microsoft证据不能当新全量90%。Word修订/目录、Excel图表/透视表、PPT母版/动画等后续逐项验证。
- 副本requestId支持当前页手动重试，尚不支持刷新后恢复未确认创建意图；遇到结果未知先核查协作空间，不刷新后盲目新建。
- PDF为明确选定的不可变服务器版本；未保存修改不自动强制保存或自动重试。PDF打印交给阅读器，原生缓存直链下载/打印权限保持关闭。
- 需要ONLYOFFICE10+且转换服务开启；30秒超时、20MB输出、每用户单并发/实例最多2个。限额为实例内保护，不是多实例共享任务队列。没有新增schema/付费渠道。

部署应同步更新API控制器、store的index/office/office-pdf、Web；旧的assistant-only增量包不含这些更改，不能用它冒充本轮发布。回退可恢复旧应用镜像/前端，新动作不修改旧内容版本或增加数据库表。
