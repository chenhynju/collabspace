# 账号安全验收 — 2026-10-23

## 变更

- 平台唯一超管已为 `chenhynju@gmail.com`，现场核对后沿用，无重复创建、无密码重置。
- 新增 `/account/security`，侧栏底部“账号安全 · 修改密码”。要求当前密码、新密码与确认；成功后重新登录。
- 认证主体由服务端确定，拒绝伪造目标用户；bcrypt12、旧散列CAS、密码长度及失败次数约束。
- 改密撤销旧JWT、未用文档票据及Office租约；原生文档WS复核凭证，旧连接不能持久写入或收到ACK。详见 ACCOUNT-SECURITY.md。
- 无数据库迁移。此次JWT格式升级，所有历史登录需重新登录一次，密码不改变。

## 本地与CI

| 验收 | 结果 |
| --- | --- |
| API TypeScript构建 | PASSED |
| Windows Next.js完整生产构建 | PASSED |
| 真实非特权PG密码测试与真实WS改密后拒绝写入 | PASSED 3/3 |
| 原协作PG/WS回归 | PASSED 32/32 |
| API回归（含真实Redis OAuth） | PASSED 21；1个真实PG测试在该命令跳过，已单独完整执行 |
| Web单元测试 | PASSED 11/11 |
| GitHub CI，源提交5182a6e | PASSED [run39825558240](https://github.com/chenhynju/collabspace/actions/runs/39825558240) |

命令：`pnpm --filter @teamspace/api build`；`NEXT_DIST_DIR=.next-password pnpm --filter @teamspace/web build`；`node scripts/test-password.cjs`；`node scripts/test-collab.cjs`；API/Web实际package脚本。

## 发布

- 代码：`5182a6e0ceb60abbcfdf08d0bb48676bc53b184f`，已推送私有仓库。
- API/WS：`r20261023-01`，仅在原精确镜像上复制103KB已编译JS/CJS，无安装、无网络构建。API镜像a8722ef078fe；WS镜像2385f736672f。
- 发布前数据库备份986321字节，上传文件157640字节；pg_restore目录校验通过，未做本轮完整恢复演练。RLS运行门禁与API/WS readiness通过。
- Vercel：`dpl_Fzi1C3YxqWCTBsgkKgRzpfmXHrtG`，正式域名collabspace.purelamp.uk已切换，36页构建通过。最终前端修复提交7083c58。
- 旧机磁盘98%，当前仍约1.2GB可用。本轮仅添加小补丁，不清理其他工程、不复制重型依赖。
- 首次线上浏览器执行因测试选择器同时匹配密码错误及Next路由announcer失败；收窄至表单提示后重跑，应用实际正确返回“当前密码错误”。第二次执行发现改密成功后布局登录保护覆盖提示跳转；已修为完整页面跳转并用无敏感信息的一次性会话标记保留成功提示，Windows生产构建再次通过。两次失败均已确认演示密码恢复。

## 边界

- IM空闲旧连接30秒周期复核，原生文档通常10秒复核；下一授权操作直接拒绝，不宣称所有网络消息即时撤回。
- 本轮不宣称Office原生引擎中密码变更场景完整人工验收、OAuth供应商配置、压测或高可用完成。
- 改密后回滚必须保留凭证印记校验，不可恢复只检查JWT过期的旧认证逻辑。
- 明文密码只直接交付用户；仓库无密码矩阵明文、令牌或私密部署配置。

## 最终线上结果

- PASSED：账号安全浏览器1/1（33.6秒）。真实页面验证错误当前密码、确认不一致、未登录拒绝、伪造目标用户拒绝、成功改密提示、旧JWT401、旧密码401、新密码实际登录；再通过页面改回原演示密码，原密码200、临时密码401。私密恢复记录已删除。账号安全截图已人工查看，字段为空、无凭据。
- PASSED：三账号文档协作1/1（1.2分钟），在线编辑、离线重连、评论、版本和恢复私有副本。
- PASSED：双账号IM1/1（37.1秒），消息无重复，刷新历史正确。合计回归2/2。
- 四个账号现场核对：chenhynju@gmail.com平台超管及平台运营空间OWNER；owner@acme.dev组织OWNER；admin@acme.dev组织ADMIN；member@acme.dev组织MEMBER。生产原密码均可用，超管密码本轮未修改。
- 线上命令采用COLLAB_BROWSER_CONFIG指向忽略私密配置、--reporter=list及独立output目录；改密测试需显式PASSWORD_BROWSER_TEST=1，finally自动恢复演示密码。
- 截图：account-security-online.png、account-password-changed-online.png、account-regression-documents.png、account-regression-im-owner.png、account-regression-im-member.png。保留历史截图原件，未覆盖历史验收结论。
`7083c58`最终修复CI：PASSED [run39827858822](https://github.com/chenhynju/collabspace/actions/runs/39827858822)。
