# TeamSpace IM 验收证据（AT09）

- 时间：2026-10-20T00:07:54.115Z
- API：http://localhost:43123/api/v1
- 结果：24/24 通过

| 检查项 | 期望 | 实际 | 结论 |
| --- | --- | --- | --- |
| 私聊创建 | 201 + 会话 id | 201 {"id":"cmvfx8crz002s10qlmstc3skm"} | PASS |
| 私聊幂等（对端再建返回同一会话） | cmvfx8crz002s10qlmstc3skm | 201 cmvfx8crz002s10qlmstc3skm | PASS |
| 拒绝与自己私聊 | 400 SELF_CHAT | 400 SELF_CHAT | PASS |
| admin 发送文本消息 | 201 + 消息 id | 201 {"id":"cmvfxckgm0036mtkwvczccepy","senderId":"cmvfdeip1000tboezhocx5xxx","senderName":"柯博文","type":"TEXT","content":"owner，方案文档看过了吗？","attachment":null,"createdAt":"2026-10-20T00:07:48.886Z"} | PASS |
| owner 会话列表未读数=1 且标题为对端名字 | unreadCount=1, title=柯博文 | 200 unread=1 title=柯博文 | PASS |
| 标记已读后未读数归零 | unreadCount=0 | read=201 unread=0 | PASS |
| 上传图片附件 | 201 + 附件 id | 201 {"id":"cmvfxclhr003imtkwri5eo6bd","name":"pixel.png","size":"70","mimeType":"image/png"} | PASS |
| 发送图片消息 | 201 + attachment | 201 {"id":"cmvfxclmh003omtkwcqinwzvw","senderId":"cmvfdehho000rboez0ml1qugj","senderName":"陈知微","type":"IMAGE","content":"截图如下","attachment":{"id":"cmvfxclhr003imtkwri5eo6bd","name":"pixel.png","mimeType":"image/png","size":"70"},"createdAt":"2026-10-20T00:07:50.394Z"} | PASS |
| 发送文件消息 | 201 + attachment | 201 {"id":"cmvfxclpt0040mtkwdgncj0t3","senderId":"cmvfdehho000rboez0ml1qugj","senderName":"陈知微","type":"FILE","content":"需求文档","attachment":{"id":"cmvfxclo8003umtkwl5fs6xy8","name":"spec.txt","mimeType":"text/plain","size":"22"},"createdAt":"2026-10-20T00:07:50.513Z"} | PASS |
| admin 拉取历史含 3 条消息（TEXT/IMAGE/FILE） | 3 条，类型齐全 | 200 数量=3 类型=TEXT,IMAGE,FILE | PASS |
| 会话成员可下载图片附件 | 200 image/png 70B | 200 image/png 70B | PASS |
| 创建群聊 | 201 + 会话 id | 201 {"id":"cmvfxcltq004amtkwhirbtopw"} | PASS |
| 群详情含 3 名成员 | 3 | 200 成员数=3 | PASS |
| 群成员发言 | 201 | 201 {"id":"cmvfxclw3004lmtkwtmm5b2g5","senderId":"cmvfdeil2000sboezj7axczwk","senderName":"陆小鹿","type":"TEXT","content":"收到，今天提测。","attachment":null,"createdAt":"2026-10-20T00:07:50.739Z"} | PASS |
| owner 群聊未读数=1（member 的发言） | unreadCount=1 | unread=1 | PASS |
| 非群主移除他人被拒 | 403 NO_PERMISSION | 403 NO_PERMISSION | PASS |
| 被移出群的成员再发言被拒 | 403 NOT_MEMBER | 移除=200 发言=403 NOT_MEMBER | PASS |
| 跨组织读取消息被拒（应用层） | 403 NOT_MEMBER | 403 NOT_MEMBER | PASS |
| 伪造 acme 组织头被拒 | 403 NOT_MEMBER | 403 NOT_MEMBER | PASS |
| 跨组织下载附件被拒 | 403/404 | 404 | PASS |
| RLS 防御层：globex 上下文直查 acme 消息 | 0 行 | 0 行 | PASS |
| RLS 对照：owner 上下文可查本会话消息 | >0 行 | 3 行 | PASS |
| 会话成员实时收到 im:message:new | payload 含新消息 | 收到 实时推送测试 | PASS |
| 非会话成员收不到该消息推送 | TIMEOUT | 未收到（符合预期） | PASS |
