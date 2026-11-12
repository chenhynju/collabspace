# 项目实时会议：M1–M3需求与详细设计

2026-10-28新范围覆盖旧REQUIREMENTS中“视频会议不实现”的约定；只扩展项目协作，不替换IM或Yjs。当前开发中，设计不是验收结论。语音与数字人的完整范围及阻塞沿用RTC-VOICE-PERSONA-RELAY.md。

| P / BR / D / AT | 用户结果和规则 | 验收 |
| --- | --- | --- |
| RTC01 | 有WRITE项目权限的有效成员创建会议；READ成员可列表/加入。组织/账号/项目必须有效，归档项目拒绝。创建UUID幂等，相同ID不同内容409 | 正常创建、重复创建、冲突、跨组织/只读拒绝；提交后列表刷新持久化 |
| RTC02 | Nest签发10分钟、仅绑定会议房间/当前用户的入会凭证；客户端不能指定身份、房间或管理权限；服务器复核未就绪不签发 | 解码验证最小grant；无配置/复核未就绪503；失权/结束后新签发拒绝 |
| RTC03 | 主持人结束：ACTIVE→ENDING→ENDED；先提交ENDING禁止新凭证，再删媒体房间；供应商失败保留ENDING可重试，不能假报结束 | 并发签发/结束按会议行锁序列化，超时重试、重复结束、非主持人拒绝 |
| RTC04 | M2双账号真实音视频、设备权限/选择/开关、断线和离开释放 | 实际远端媒体和轨道状态证据，fixture和真人设备分开 |
| RTC05 | M3屏幕共享/取消/停止，持久聊天、断线/刷新恢复；消息服务端鉴权和幂等，commit后Socket.IO发刷新提示 | 对方实际共享画面，历史恢复及拒绝矩阵 |

## 权威与存储

会议业务状态唯一写入方Nest，媒体轨道唯一权威LiveKit。`rtc_meeting`使用UUID、organization_id、project_id、host_id、title、status、created_at/ended_at；(id,organization_id)唯一，project复合外键，FORCE RLS组织隔离；所有应用查询显式org。未知会议/跨租户404。客户端只展示业务状态，不以LiveKit connected判定结束。

默认媒体部署配置显式选择`LIVEKIT_DEPLOYMENT=cloud|self-hosted`，不猜测凭据。生产URL须wss；本机隔离自托管可ws://127.0.0.1或localhost。不读取用户提交的URL，防止SSRF。无配置时会议创建和状态管理仍可本地验证，加入返回可解释503，UI不显示已接通。

## 凭据与撤权边界

使用livekit-server-sdk签JWT、RoomServiceClient结束房间；Secret仅后端。房间名和身份使用散列/UUID，不含姓名邮箱。不得授予roomAdmin/roomCreate/roomRecord；capabilities仅camera/microphone/screen_share，数据消息走鉴权持久化入口。

10分钟TTL只约束连接，不限制已有/自动刷新连接。R3由60秒调整为600秒，以覆盖供应商5分钟刷新间隔；不声称它修复了已有网络故障。Cloud撤权仍使用显式未来cutoff，不以过期代替撤权证明。官方说明：[token生命周期](https://docs.livekit.io/frontends/reference/tokens-grants/)。自托管仍拒绝签发。**媒体验收未完成前保持本地开发，不发布；不以单个撤权样本代表全部组织/资源变更安全矩阵。** 不用浏览器心跳作为恶意客户端的安全边界。

## R3：持续访问复核与断线恢复

`MEETINGS_ACCESS_MONITOR_ENABLED=true` 为后端开关，与 `MEETINGS_ENABLED=true`、有效LiveKit Cloud配置共同使用。启动执行一次服务器复核，之后每30秒执行，不重叠。最近成功复核超过90秒、首次复核未成功或开关关闭时，状态configured=false，拒绝新入会503；不需要额外API key。必须先应用本轮附加SQL，不能只开启开关。

唯一跨组织的维护入口 `rtc_access_candidates()` 无输入、SECURITY DEFINER、固定pg_catalog search_path，PUBLIC无执行权限，仅既有应用角色可执行。它轮转领取最多10个未结束且已发凭证的会议，仅返回复核所需标识/状态，不返回消息正文。普通会议/聊天读写继续组织参数+RLS。实际每个主体都重新进入服务端确定的组织/用户上下文，复用账号、组织、项目和ResourcePolicy鉴权；失权或ENDING时经Cloud显式撤销凭证并移除主体，RPC确认后才标记revoked_user_ids，审计actor=null/source=server-monitor。未知DB/供应商错误不记为成功，保留后续重试；重新合法入会清除该主体旧复核标记。

这是有界轮转复核，不承诺任意规模30秒全部处理，也不能在API/数据库/供应商全面停机时保证现有媒体立即停止。单进程防重叠；多实例可重复复核，标记和审计写入幂等。未来规模认证/灾难隔离另验收。

断开/重连中/加入失败提供“重新验证并入会”：先清理旧Room，再创建新Room并走当前JWT/组织/项目鉴权获取新凭证，设备默认关闭。不会自动复用失效票据或自动恢复麦克风。真实Cloud删除房间后的恢复、成员停用后拒绝新签发，以及不运行应用心跳的SDK客户端被服务器踢出/旧票401，见R3证据。

## 接口与错误恢复

全局前缀沿用/api/v1、JWT及OrgContextGuard。

- GET /meetings/status：只返回configured/deployment，不返回凭据。
- GET /meetings?projectId=…：鉴权后最近50条。
- POST /meetings：{requestId UUID, projectId, title(1–120)}；WRITE，DB去重/事务审计。
- POST /meetings/:id/join：READ；返回短期token和配置媒体URL，Cache-Control:no-store，不记录token。
- POST /meetings/:id/end：host，ENDING可重试；未知外部结果503/ENDING；成功后事务ENDED及审计。

每次操作验证组织、账号和项目。创建按组织+actor事务锁约束最多5个未结束会议；并发重试使用相同requestId；输入有长度和UUID上限。结束不跨数据库事务等待外部服务；确认删除后重新核验并提交最终态，进程中断由host重试恢复。

## UI与运行

项目详情新增“视频会议”页入口，按组织/项目key销毁组件；先完成M1列表/创建/结束/加入状态，再接M2媒体与M3聊天，不放无效录制按钮。M4录制不在本次必达。变更只在隔离合成数据环境应用SQL，不自动生产迁移/发布。

官方参考：[Server SDK](https://docs.livekit.io/reference/server-sdk-js/)、[Token语义](https://docs.livekit.io/frontends/reference/tokens-grants/)。验收报告必须区分域规则单元、应用角色真实SQL/API、媒体服务真实双账号、生产四层证据。


## M3 持久消息实现

`rtc_message` 具有组织/会议复合外键、FORCE RLS，只有服务端授权后写入；POST `/meetings/:id/messages` 接收 requestId UUID 和 text（1–2000字符）。WRITE 权限、ACTIVE 状态、每人每会议每分钟30条上限；重复相同请求返回原消息，重复编号改文冲突。审计记录messageId，不记录消息正文。会议行锁串行化结束与发送，已结束只读历史。

GET `/meetings/:id/messages?before=<message UUID>` 以(created_at,id)复合游标按倒序每页100条，不因同时间戳跳过消息；游标限定同组织同会议。UI每3秒同步最近消息，用户可加载更早记录；纯文本渲染，重新打开恢复数据库历史。当前为HTTP轮询；WebSocket推送和高并发性能尚未验收。数据库测试使用真实PostgreSQL，浏览器fixture仅验证UI，不替代真实API/媒体验收。


## R2：入会设备与提交后事件

入会设备检查为本地显式操作：摄像头预览、麦克风捕获、系统默认/设备ID选择、拒绝权限与设备缺失提示、停止、组件卸载/入会/退出登录/关闭页面释放轨道。默认不采集；预览不上传、不录制，不循环播放麦克风声音。入会后开启轨道使用预先选择的deviceId。真实硬件及系统权限需人工验收，自动测试使用合成MediaStream。

消息数据库事务成功返回后由RealtimeEventsService向经过现有project:open鉴权的项目房间发meeting:changed提示，仅org/project/meeting ID，无消息正文。客户端经useProjectRealtime按org/project过滤，触发重新鉴权拉取列表/历史，重连也刷新；3秒轮询保留为恢复机制。广播失败不回滚已提交消息，重复请求可再发刷新提示而不重复写消息。提交前不广播。


## R2 严格结束修正（覆盖此前删除即结束实现）

真实Cloud发现：DeleteRoom可断开双方，但fresh unused入会token仍能重建/进入原房间。现新增issued_user_ids持久签发名单，事务内记录并限制25位不同成员；ENDING提交后不再签发。结束先取当前媒体成员，合并已签发身份，对每个身份调用RemoveParticipant并显式revokeTokenTs=当前UTC秒+30，再DeleteRoom。任何撤销不确定则维持ENDING，不冒报ENDED。删除阶段not_found才按幂等成功处理；撤销阶段not_found不吞掉。历史已发凭据但名单/当前成员均为空时拒绝假报撤权完成，需人工核查。

真实复测：fresh token于结束前签发，撤销后3.294秒尝试重入，ConnectionError reason=NotAllowed/status401，PASS；合成双端媒体与共享同轮PASS。不是仅等待TTL过期。Cloud时钟偏差/刷新token长时间会话/节点切换仍需专项验收。自托管缺严格撤销能力，当前configured=false、拒绝签发，直到实现媒体准入网关。默认生产开关仍false。

依据： https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/ 、 https://docs.livekit.io/frontends/reference/tokens-grants/ 。
