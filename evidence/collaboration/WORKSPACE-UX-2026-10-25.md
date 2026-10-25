# 统一协作空间 UI/UX 验收 — 2026-10-25

## 交付

设计：[Figma](https://www.figma.com/design/bC8YHgedUX0LiMhjdScn77)。桌面文件页4:130、助手双栏4:327、移动端4:434。可编辑文本35/36/21，组件实例10/10/12；交付画板无整页截图或图片填充。图标复用工程已有lucide，视觉检查后修复自动布局高度、移动间距及功能图标。

侧栏合并入口，保留旧assistant地址；五种AI功能和新建类型使用图标直接点击。上传、助手资料和Office图片准备使用统一原生可访问文件控件。宽屏双栏、小屏纵排；切换视图保留输入并停止朗读和未完成生成。邮件保留预览、确认、幂等重试与会话恢复。

## 本地 PASSED

独立环境 `.test-runs/ui-unified-1025`：Web43420/API43421/WS43422/PG5582，合成数据；运行DB角色teamspace_app非superuser、非bypassrls。测试Redis6399仅本机、无持久化。

- `pnpm --filter @teamspace/web exec tsc --noEmit` 退出0。
- `NEXT_DIST_DIR=.next-ui-unified-build pnpm --filter @teamspace/web run build` 最终退出0，38页。两条原有register hook及MessageBubble img lint警告，未引入新警告。
- Playwright `assistant.spec.cjs`：真实登录/项目/MD解析；AI与邮件替身；摘要、双向翻译、1201字禁用、朗读及切换视图停止、确认前零发信、502后刷新恢复相同编号重试；通过，最终1.4分钟。
- `unified-workspace.spec.cjs`：项目传递、邮件直接入口、仅切换不调用AI、视图间草稿保留、可访问原生选择控件、拖入MD后真实201创建并打开、列表查到新文件、类型图标、Escape、390px无整页溢出；通过，1.1分钟。
- `office-image-preparation.spec.cjs`、`office-page-polling.spec.cjs`：实际编码/透明度/原图/下载和十次轮询无面板重复；最终2项通过，15.8/5.7秒。
- `ui-refresh.spec.cjs`：桌面工作区/附件/账号安全及移动侧栏导航；通过56.4秒。
- `workspace-hub.spec.cjs --grep create/import`：富文本/Markdown/白板创建、MD/Mermaid真实保存、元数据/筛选/项目与旧路径、移动导航；通过2.5分钟。

浏览器统一命令使用 `COLLAB_BROWSER_CONFIG=.test-runs/ui-unified-1025/config.json`、`pnpm exec playwright test ... --reporter=list`。截图在`.test-runs/unified-ui`和`.test-runs/content-hub-browser`，已目视核对桌面/移动与上传弹窗。

## 排障与边界

初次本地API启动因Redis未运行而等待，启动临时Redis后恢复；验收环境邀请后台表invitation_delivery未建，邀请队列不属于本轮通过项。首次拖放已返回201，但开发编辑器冷编译超过原30秒；测试分开核对创建回执与页面打开并允许120秒，最终通过。增加dialog语义后修正文件输入选择器歧义；弹窗补齐Escape、焦点约束和返回焦点。

本轮所有AI生成及邮件发送均使用浏览器替身：真实模型token消耗0，真实测试邮件0。未改后端、数据库schema、Office引擎、品牌或图片传输链路；不把UI重构宣称为解决全部Office性能问题。真实供应商送达、硬件语音质量及完整Office往返不纳入本轮成绩。

共享语音/数字形象规划文件及其README/需求追溯改动保留；本轮仅提交UI相关代码、测试、规范和证据。

## 发布

本地已通过；前端生产部署与在线复验结果将在完成后追加。API与Office保持现有运行版本。
