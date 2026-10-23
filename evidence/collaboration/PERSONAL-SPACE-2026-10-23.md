# 可选组织注册与上下文隔离验收 — 2026-10-23

实现955763c6b55d30f9bf150878277694dc06eb5885。组织名称不作为功能开关；沿用服务端自动创建组织/ACTIVE成员/OWNER角色，修复新旧账号组织缓存和晚响应污染。

PASSED：前端14/14（含新增3个身份与组织缓存回归）；Windows完整生产构建 .next-personal-space，36页；本地真实注册浏览器1/1（22.4秒）。首次本地执行在API完成启动前连接被拒，等待实际监听后完整重跑通过，未将其记为业务通过。

Vercel dpl_2ePV5n2vrgUVBtRsXyUpKnC8WBU8 正式域名已切换；旧Figma部署dpl_3qRKwUyjHvVrS2JE8aykqVj3xzEo保留。无API/数据库迁移。CI [39944249061](https://github.com/chenhynju/collabspace/actions/runs/39944249061) PASSED。

线上PASSED 2/2，1.6分钟：
- 50.7秒：Figma工作台真实新建、双账号Yjs同步、实时评论、侧栏、SVG导出、最近搜索、手机导航。
- 33.1秒：旧账号/组织缓存下留空团队名称注册新合成账号，完成现有console验证链接流程；取得自身独立组织与OWNER；创建工作区、项目及图表，通过真实WS保存、刷新持久化；伪造旧组织头403，新旧两组织双向HTTP和session-ticket拒绝；强制写入旧组织缓存再刷新会自动恢复自身空间。

邮件验证采用当前console提供器，只针对example.invalid合成邮箱私密读取其验证链接，不代表真实外部邮件投递。未打印口令/令牌或将trace、私密配置提交仓库。个人注册与成员权限拒绝是真实服务端结果，未放开NOT_MEMBER守卫。

personal-space-online.png为最终线上截图。合成用户、工作区和文档仅用于本次验收，未改已有用户凭据或原文档。普通平台运维权限仍不向新用户开放，资源授权与组织隔离保留；本轮不改变原套餐/支付配置。

用户追加注册—邀请—个人通知需求已记录 docs/collaboration/INVITATION-NOTIFICATIONS.md，明确待实现；现有组织公告和IM不是该闭环的完成证据。
