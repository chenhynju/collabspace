# 注册、邀请与个人通知

2026-10-23 实现；验证与部署结论见 evidence/collaboration/INVITATIONS-2026-10-23.md。Figma 参考文件 7IwWhVlznS5r8Q8xkU16VW，工作台 5:13、编辑器 5:101；通知页面沿用现有深色侧栏、浅色内容区、卡片与按钮。一级分组与次级菜单均为 14px。

## 业务契约与追溯

| 需求 | 实现 | 验收 |
|---|---|---|
| INV01 自主注册不填写组织也可正常使用 | 创建独立个人组织、OWNER 与 FREE 权益；资源仍受组织/ACL 限制 | personal-space.spec.cjs |
| INV02 已注册邮箱收到个人邀请 | 事务内生成 RECEIVED 通知，提交后向 user 房间发送刷新事件，15秒轮询兜底 | invitations.integration.test.cjs、invitations.spec.cjs |
| INV03 未注册邮箱收到邀请邮件 | 加密 outbox；注册页按服务端凭证预填并锁定邮箱/组织；不采纳客户端组织名作为入组依据 | 同上、test-invitation-delivery.cjs |
| INV04 明确同意或拒绝 | 邮箱验证后仍须点击接受；邀请注册始终验证邮箱，即使普通注册关闭验证；普通注册允许直接登录时也不伪造邮箱已验证标记，仍发送验证链接，接受邀请必须验证；注册只建个人空间，不复制目标企业 | 同上 |
| INV05 邀请者收到处理结果 | ACCEPTED/DECLINED 个人通知与业务事务一起提交；每邀请/事件/收件人唯一 | 同上 |
| INV06 数据受限访问与组织隔离 | 个人收件箱只按JWT身份；接受时复查邮箱、组织、邀请者权限、角色和席位；组织资源仍需成员和资源ACL | 真实非特权PG/HTTP与多账号浏览器 |

## 状态与一致性

PENDING → ACCEPTED / DECLINED / REVOKED / EXPIRED。接受与拒绝按组织行、邀请行的固定锁顺序串行化；同一终态重复请求幂等，其他终态拒绝。过期按实际时间判断；列表可惰性标记 EXPIRED。仅接受设置 accepted_by/accepted_at，拒绝的处理人/时间在审计与通知中记录。不能通过邀请授予 OWNER。接受时检查有效邀请者和角色、邮箱归属及席位；拒绝不创建目标组织成员关系。

通知表 personal_notification：organization_id 表示事件来源，recipient_id 是唯一读/已读权限边界。FORCE RLS 防御层；运行角色只有 SELECT 与 UPDATE(read_at)，不能改正文或直接插入。两个固定 search_path 的管理员持有函数仅生成受约束的邀请事件，PUBLIC 无执行权，运行角色单独授权。未加入目标组织的收件人可以读取邀请的最小必要信息，不能借此读取项目、文档或其他通知。

## 邮件交付

invitation_delivery 与邀请同事务写入，AES-256-GCM 加密收件人/链接/组织，密钥从服务器 JWT_SECRET 派生，原始邀请凭证不进入审计。后台通过 SKIP LOCKED 和90秒租约领取任务，最多5次，失败一分钟后重试；Resend 使用稳定的邀请ID作为幂等键。成功或取消后清除加密载荷。数据库完成确认失败可能重新调用供应商，因此依赖供应商幂等窗口，并不宣称无限期 exactly-once。

状态 PENDING / SENDING / RETRY / SENT / SIMULATED / FAILED / CANCELLED。console 只能是 SIMULATED，不代表真实发信。演示模式管理员可见模拟邀请链接；已注册邮箱走站内通知，不暴露原始链接。当前生产是否配置真实邮件以验收记录为准；未配置时真实邮件闭环明确 BLOCKED。

## 迁移、部署与回滚

兼容迁移 deploy/collabspace/2026-10-23-invitations.sql 增加 DECLINED、通知表、outbox、RLS与受约束函数。管理员迁移工具 apply-invitations.cjs 要求管理员连接和独立非特权运行连接，只给核实后的运行角色授权。CI 在启动API前应用迁移。生产先做数据库/上传备份，再迁移授权，验证非特权运行与新版本健康，最后切换前端。

新枚举出现后，回滚旧后端也必须保留识别 DECLINED 的 Prisma 客户端；禁止删除或改写已产生的拒绝记录。保留带兼容客户端的旧业务镜像和旧前端部署。JWT_SECRET 轮换会使未投递的旧加密任务不可解密，须先排空或兼容迁移，不把凭据轮换当成透明操作。

真实供应商送达、邮箱垃圾箱与邮件退信处理另列边界。个人通知目前保留最近100条；不是邮件客户端、群聊或组织公告替代。Webhook、AI Agent、全面高可用不在本次范围。
