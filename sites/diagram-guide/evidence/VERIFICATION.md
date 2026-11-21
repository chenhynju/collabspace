# 画布之上 — 交付与验证说明

## 交付物

- 站点源码：`sites/diagram-guide/`
- 需求文档：[docs/PRD.md](docs/PRD.md)
- 设计规范：[docs/DESIGN.md](docs/DESIGN.md)
- 生产地址：https://diagram-guide.vercel.app/
- 最终部署 ID：`8JhmnToXKktJAhgyyo9VArnFxB3k`
- 前一次部署 ID：`9kzo6QFKhWMK47NTeGaMV4KXx7aT`
- 首次部署 ID：`4v4RnL1Czn4SbtJ6x7TrCm4CsNDs`

## 技术实现

- 零依赖静态站点：HTML + CSS + ES Modules。
- 无框架运行时、无 Web 字体、无图片请求；首屏 4 个请求。
- 内容数据集中在 `assets/data.js`：7 层、7 工具、6 步问答。
- 交互：阶梯定位矩阵、矩阵筛选/单元格说明、工具卡筛选、六步选型向导、主题切换持久化、移动端菜单、滚动 reveal。
- 主题：`data-theme` + CSS 变量；默认跟随系统，手动切换写入 `localStorage`。
- 无障碍：原生按钮/单选控件、焦点环、`aria-live`、`aria-pressed`、`aria-label`、`prefers-reduced-motion`。

## 自测结果

### 本地（Python static server / Chrome）

| 项 | 结果 |
| --- | --- |
| 层级 / 工具 / 矩阵 | 7 层、7 工具、49 个单元格、7×8 表头 |
| 阶梯 → 矩阵 | 点击 AI 层，对应行高亮并滚动，详情更新 |
| 矩阵筛选 | “企业治理” 5 个工具列；层筛选 1 行；重置恢复 7×8 |
| 手风琴 | 全部展开 7 / 全部收起 0 |
| 工具筛选 | “免费起步” 4 张卡 |
| 选型助手（个人 / 免费） | Excalidraw，匹配度 98，推荐/注意事项/备选齐全 |
| 选型助手（50+ / 合规 / 企业） | Lucidchart，匹配度 98 |
| 主题 | 暗→亮切换、`aria-pressed`、刷新后保持 |
| 移动端 390px | 页面无横向溢出；菜单可开；矩阵容器内滚动；首列 150px |
| 控制台 | 无错误 |
| 性能（本地） | LCP 1296ms；4 个资源；传输约 80KB |

### 生产（腾讯云服务器 Chrome，2026-11-21）

| 项 | 结果 |
| --- | --- |
| HTTP | 200 |
| TTFB | 141ms |
| LCP | 984ms |
| DOMContentLoaded / Load | 946ms / 962ms |
| 资源 | 4 个，24,862 bytes |
| 生产交互 | 阶梯定位、企业治理筛选（6 列 × 7 行）、选型助手 Excalidraw 98 全部通过 |
| 移动端 | 无页面横向溢出，菜单与矩阵滚动正常 |
| 控制台 | 无错误 |

结论：首屏加载满足 < 2s；从中国腾讯云节点实测 LCP 约 1.0s。

## 部署与 CDN

- Vercel 项目：`purelamp/diagram-guide`
- 生产别名：`https://diagram-guide.vercel.app`（已 Aliased，200）
- 项目 Git 自动部署已断开，当前以 CLI 部署为准，避免仓库根目录与站点目录冲突。
- Vercel Edge Network 自动提供全球 CDN、HTTPS 与缓存。
- `vercel.json` 配置：
  - 静态资源 `Cache-Control: public, max-age=31536000, immutable`
  - 安全头 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`
  - `cleanUrls`、`trailingSlash: false`

## 自定义域名（待 Cloudflare 确认）

已把 `diagram.purelamp.uk` 加入项目，但域名 DNS 在 Cloudflare，当前为 `Invalid Configuration`。

二选一：

1. 打开 Vercel Domain Connect（在 Cloudflare 中批准自动配置）：
   https://vercel.com/api/v9/projects/prj_TcBR0730uA0gbdzoTOUXoghYXrab/domains/diagram.purelamp.uk/domain-connect/apply?teamId=team_oq37yZTz11Ij6z4vZxmxvEeV
2. 在 Cloudflare 添加记录：
   - 类型：`CNAME`
   - 名称：`diagram`
   - 目标：`1bf145d76b683730.vercel-dns-017.com`
   - 代理：关闭（DNS only）

批准后执行 `vercel domains verify diagram.purelamp.uk` 验证。

## 监控

- 可用性探针：`https://diagram-guide.vercel.app/health.json`（200，返回服务名与版本）。
- 建议外部 uptime 服务每 1–5 分钟探测 `/health.json`，以非 200 或内容不匹配告警。
- Vercel Web Analytics / Speed Insights 命令已确认存在，但启用需要交互确认；Speed Insights 可能产生费用，因此未在未授权情况下开启。可在项目设置中启用：
  - `vercel project web-analytics enable diagram-guide`
  - `vercel project speed-insights enable diagram-guide`
- Vercel 部署日志：`vercel inspect diagram-guide.vercel.app --logs`。

## 设计说明

- 没有提供 Figma 文件，因此未执行 Figma 节点还原；按 `docs/DESIGN.md` 的设计规范直接实现。
- 视觉方向为“蓝图 / 夜间工作台”：暗色默认（跟随系统）、蓝图网格、荧光青柠强调、衬线标题与等宽数据标签。
- 主要记忆点：首屏右侧七层阶梯，点击后矩阵像被游标定位。

## 归档

- 截图：`evidence/`（本地亮/暗首屏、层级、工具卡、生产矩阵、选型结果、移动端）。
- 源码压缩包：`sites/diagram-guide-2026-11-21.zip`。
