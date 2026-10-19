# 复制来源与交付边界

日期：2026-10-19（Asia/Shanghai）。

- 来源：D:\appspace\githubdesgin\catalog\full-stack\F-U01。
- 目标：D:\appspace\collaboration。检查时目标本身为空且没有子文件夹，因此按用户所指空工程目录处理。
- 源 HEAD：e49a1128da7da317d6981c76970e8a6cb079e523；源 origin 为 chenhynju/teamspace。复制的是当前文件快照，未沿用旧 .git，不声称源工作树 clean。
- 独立 git main 已初始化。根包名及内部 @teamspace/* 依赖保留以避免无必要破坏工作区；产品名为 CollabSpace。
- 排除 .git、node_modules、.next、dist、.test-runs、coverage、本地 PostgreSQL 数据目录、上传目录、备份、真实 .env、日志、bundle、Terraform 运行状态等。只保留环境示例。
- 第一次复制发现本地数据库目录被纳入，已中断，核实目标路径后清除目标中的这些副本并重新排除；源目录未删除或修改。

## 本轮验证

- PASSED：apps 下 180 个文件逐一 SHA256 比较，与源文件无差异。
- PASSED：目标无 node_modules/.pgdata/.pgdata2/.uploads；没有复制旧 .git。
- PASSED：常见 GitHub token、Stripe live key、私钥头、AWS access key、Slack token 模式扫描未发现对应真实凭据。连接串模式命中环境示例、部署文件及 CI 中的模板/测试配置；该有限模式扫描不是完整秘密审计。
- PASSED：新增需求、设计、可执行 prompt；根 README/AGENTS 增加当前范围入口，保留历史底座文档。
- BLOCKED：自动审批拒绝 gh repo create chenhynju/collabspace --private --source ... --remote origin；理由为尚未明确账户/仓库目的地与具体工程上传授权。远程仓库未由本轮成功创建，未推送；待用户确认后继续。不得绕过审批。
- NOT_RUN：依赖安装、底座测试、应用构建、浏览器验收、新协作功能实现、生产部署。本轮任务是复制工程、需求深化、详细设计与输出 prompt。

## 后续远程发布前检查

继承的 .github/workflows 包含 CI、CD、Hetzner 和 Terraform；未审计或执行其中部署工作流。首次推送前应先检查触发条件并禁用自动部署，确保新仓库不关联原生产资源。deploy/terraform/历史 evidence 中的域名、资源名称和旧测试成绩只是继承材料，不能证明 CollabSpace 已发布或通过验收。

推荐用户确认目的地后创建私有 chenhynju/collabspace，再设置 origin 并推送经过复核的快照；用户未指定公开发布，不能自行改为 public。
