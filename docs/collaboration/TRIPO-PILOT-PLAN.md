# Tripo三款试制草案（2026-10-29）

用户选择Tripo并填写本地凭据，确认三款试制总费用上限USD20。已仅将本地AVATAR_3D_TRIAL_BUDGET_USD写为20，其他配置值逐项保持；enabled=false、uploadApproved=false和最终格式空白不变。未上传图片、未创建收费任务。

## 可审阅范围

1. 仅知夏、知行、明悦三款，源图来自既有制作清单。实际PNG、SHA256、大小<=20MiB和尺寸>=256检查通过。
2. 草拟每款使用H系列标准贴图生成一次，再做兼容检查和身体绑骨；不批量20款，不自动重做，不擅自增加高清、动作或转换费用。
3. 2026-10-29核对[官方价目](https://developers.tripo3d.ai/en/pricing)：标准贴图图生3D30credits，身体绑骨25credits，兼容检查免费，1credit=USD0.01。三款基础单次预估165credits=USD1.65，在USD20总上限内；不含税、充值最低额、重做、动作、转换、面部绑定、捏脸或人工修模。提交前须重新核价并实现运行时累计预算账本，不能把草案预算检查当自动扣费保护。
4. 拟使用v3.1-20260211图生模型、v3.0-20260909人体绑骨、vrm骨骼命名、GLB中间文件。[官方绑骨文档](https://developers.tripo3d.ai/en/docs/animations-rig)的vrm是骨骼命名规格，不代表输出是有效VRM文件，也不能推定有眨眼/元音口型/捏脸变形。最终格式与面部资产另验收，不更改正式20款目录。

`node22 scripts/prepare-tripo-pilot.cjs`只生成ignored `.test-runs/avatar-3d/tripo-pilot-plan.json`，没有网络或执行模式。`input=null`和无taskId是刻意保留的草案状态，不能提交。`node22 scripts/check-avatar-provider.cjs`仅GET官方v3账户余额；显式--legacy-v2仅GET官方v2余额，不自动切换地区或供应商。Client ID不作为Bearer凭据。

## 当前核验

凭据前缀符合官方tsk_/tcli_形式，但不代表有效。v3只读检查TypeError，v2检查UND_ERR_CONNECT_TIMEOUT；随后本机DNS检查LiveKit、Tripo v2/v3均ENOTFOUND，尚未获得鉴权/余额结论。没有将网络失败误报为Key无效，未修改系统网络/DNS或私有Key。

待恢复海外API连接、确认余额与版本后，再由用户确认这三张指定原图的外发范围，才实现并运行受限试制；USD20是上限，不是默认消费目标。

## 免费替代方案（不自动更换已选路线）

- [VRoid Studio](https://vroid.com/en/studio)免费本地制作、调整角色并导出VRM，需人工按原图制作；编辑器的捏脸能力不等于本产品已经有客户捏脸功能。
- [Meshy Free](https://www.meshy.ai/pricing)官方当前100credits/月，网页试做；免费计划不含API。
- [Tripo Studio FAQ](https://www.tripo3d.ai/product-doc/support/faq)确认网页有月度赠送额度；[官方说明](https://platform.tripo3d.ai/docs/faq)网页与API账本分开，当前账户API赠送余额未核实，不能据旧宣传承诺免费API额度。
