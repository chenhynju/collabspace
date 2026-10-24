# 线上 PPT 插图速度实测与学习记录

时间：2026-10-25，Asia/Shanghai。用户授权使用合成PPT/图片测试。没有修改用户现有文档、服务器配置、引擎镜像、密钥或品牌标识。

## 实际链路

浏览器 → API域名Caddy的 `/office-engine/*` → 应用主机3396端口SSH转发 → 独立ONLYOFFICE引擎。已从线上Caddy站点与监听进程只读核实，运行服务名是 `collabspace-office-link.service`（不是 `office-link.service`）。编辑器返回版本路径为10.0.0。

**在原生PPT编辑器中插图，POST实际走Office引擎的upload端点，不走Nest的 `/files/upload`。** 所以不能只看Nest API日志或它的CPU就认为插图服务没有问题。

专用测试文档 `Synthetic-image-latency-c4519634.pptx`，ID `fc0af127-53f9-4a75-a98e-1619f86c8ee5`。仅使用已有合成验收账号和项目。

## 方法

- Edge headless，1600×1050。真实登录与组织权限、真实线上引擎、原生“图片 → 来自文件的图片”文件选择入口，无上传替身。
- 合成PNG：小图640×360，499642字节；大图1920×1080，6223843字节。后者是高熵随机纹理，代表难压缩的大文件，不能代指所有普通照片。
- HTTP/1.1强制模式交替小/大各两次；另外用浏览器默认协商模式测小图两次，实际协议h2。
- CDP `Network.responseReceived.response.timing` 拆分 `sendEnd-sendStart`（发送请求）、`receiveHeadersStart-sendEnd`（等待首部），`loadingFinished`记录整个POST请求。
- 不包含首次打开编辑器、用户挑图时间或最终PPT保存时间。表中是**上传POST请求完成**，不是精确像素可见或最终保存时间。
- 没有记录认证头、Cookie、请求正文、签名URL查询参数；输出路径已脱敏。

## 测量结果

单位：秒，四舍五入。

| 协议 | 样本 | 图片大小 | 发送请求数据 | 发送后等待响应 | 上传POST总耗时 |
| --- | --- | --- | --- | --- | --- |
| HTTP/1.1 | 小图1 | 0.50MB | 2.25 | 3.65 | 6.04 |
| HTTP/1.1 | 大图1 | 6.22MB | 35.03 | 2.86 | 37.89 |
| HTTP/1.1 | 小图2 | 0.50MB | 3.08 | 5.05 | 8.16 |
| HTTP/1.1 | 大图2 | 6.22MB | 32.23 | 3.76 | 36.44 |
| 默认协商h2 | 小图1 | 0.50MB | 5.99 | 6.40 | 12.40 |
| 默认协商h2 | 小图2 | 0.50MB | 3.52 | 7.23 | 10.75 |

全部上传POST返回200，且原生幻灯片截图确认图片显示。HTTP/1.1组从提交文件到媒体响应结束分别为8.94、41.80、9.14、40.99秒，**这些值不作为纯下载/渲染耗时**。同文档多次插图会有媒体缓存和后台旧图片加载；默认h2组首个媒体匹配可能对应既有图，不能用它计算严格的单张新图回显时间。可信的分段结论以各次对应的POST为准。

### 服务器只读对照

- 应用服务器负载快照约0.84，内存available约1760MiB。存在已使用swap，快照本身不能证明正在换页。
- 应用API容器快照CPU约1.2%–2.0%、内存约73MiB/384MiB；图片请求绕过该容器，这只能描述应用API，不代表Office引擎CPU。
- 应用服务器本机访问经SSH转发的Office `/healthcheck`：HTTP200，TTFB3.748ms，总计3.789ms。这是很轻的GET，只能证明当时基础往返快，不能代替6MB吞吐或图像处理测试。
- 未取得Office引擎容器的CPU/内存、逐请求处理日志，也没有采集代理逐请求upstream时间。

## 能得出的结论

1. **确实复现插图缓慢，且不是只在强制HTTP/1.1下出现。** 本次500KB小图上传POST就需要6–12秒，测试路径下比用户报告的4–5秒更慢。
2. 大图发送数据耗时32–35秒，上传链路有效吞吐约1.42–1.54Mbps。`6.22MB × 8 ÷ 1.5Mbps ≈ 33秒`，与实测接近。这里的“上传链路”含客户端网络、公共链路和代理/上游反压，不能直接说是用户宽带套餐或云服务器购买带宽只有1.5Mbps。
3. 另外还有约2.9–7.2秒响应等待，可能包含网络往返、代理转发/缓冲、上游读取与引擎处理。**浏览器的Waiting不等于纯服务器CPU计算时间。** 缺少引擎/代理逐请求日志，暂不能精确归因。
4. 没有证据把问题定性为“ONLYOFFICE固定需要4–5秒”或“CPU一定太小”。最先可验证的优化方向是缩减上传字节、检查客户端到上传入口的线路/吞吐，再拆代理与引擎等待；不应直接购买更多CPU或永久关闭HTTP/2。
5. HTTP/1.1和h2样本少、时间不同、缓存及网络条件不同，不是严格A/B测试，不能据此声称HTTP/2必然更慢。

## 自己如何在浏览器学习排查

1. F12 → Network，清空记录，勾选Preserve log，先保持同一缓存设置。
2. 在已经打开的PPT里插入图片，筛选 `upload`。查看请求体大小、Status、Protocol和Timing。
3. Request sent长：先检查字节数和上传链路；Waiting长：检查整条服务链，不能直接断言CPU慢；Content Download长：再查回传吞吐。
4. 继续找该次上传返回URL对应的媒体GET；别把之前图片的后台加载、页面初始化或保存请求算到这张图上。缓存命中和实际网络下载要分别记录。
5. 用相同文档、相同图、同样缓存状态重复几次，再用较小图比较。记录样本数与协议；不要用两次样本计算可靠p95。

## 复现脚本与证据

```powershell
python scripts/generate-office-image-fixtures.py
$env:COLLAB_BROWSER_CONFIG='.test-runs/deploy/online-config.json' # 私密合成账号配置，不提交值
node scripts/profile-office-images.cjs inspect
node scripts/profile-office-images.cjs measure
$env:OFFICE_PROFILE_HTTP1='0'
$env:OFFICE_PROFILE_SIZES='small,small'
node scripts/profile-office-images.cjs measure
```

脚本会在没有本地document.json时创建一个合成PPT，后续复用该测试文档；不要指向用户工作文档。下一轮若需更严格回显统计，应对上传响应中的具体媒体URL进行精确关联，并记录冷/热缓存，当前不要扩大回显结论。

私密诊断目录 `.test-runs/ppt-image-profile/` 包含：`measurements-http1.json`、`measurements-default.json`、初始加载元数据、逐次截图与合成图片。目录被Git忽略。报告不包含密码、JWT和签名URL。

## Logo 问题

本次保留原生ONLYOFFICE品牌。官方 [许可FAQ](https://www.onlyoffice.com/license-faq) 对社区版原标识保留有要求；[官方品牌定制对比](https://www.onlyoffice.com/white-label) 区分Developer标准Logo替换与扩展White Label的加载页面、名称及About等定制。未做未经授权的隐藏、替换或源码修改。
