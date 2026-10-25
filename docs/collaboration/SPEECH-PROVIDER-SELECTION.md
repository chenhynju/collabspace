# 国内外语音服务选型

2026-10-25用户最新决策：**国内外统一Azure STT+TTS；OpenAI作为未来海外版可选适配**。用户确认当前没有语音/真人服务账号配置，不创建付费资源。以下供应商比较保留为调研记录，不覆盖此决策。

## 已确定的接入方式

- 当前仅启用Azure适配；AZURE_SPEECH_CLOUD=global或china，资源地区/密钥必须属于对应云。实例配置决定音频处理链路，不按页面语言或IP偷偷切换。中国云和全球云账号/资源/端点分别核对，不把使用同一品牌理解为同一资源可跨云调用。
- 全球云短音频STT/TTS分别使用stt.speech.microsoft.com和tts.speech.microsoft.com；中国云使用stt.speech.azure.cn和tts.speech.azure.cn。已增加匹配校验，非法cloud或中国地区/全球云混用时失败关闭。真实跨地区延迟、音色可用性和调用效果仍待开通后验收。
- Azure中国云支持STT/TTS，但官方明确不支持TTS avatar等部分能力；真人视频仍单独选型。
- OpenAI海外版预留转写、TTS、Realtime三种能力，当前不新增依赖或默认调用。普通IM听写先用录音转写，连续语音Agent再评估Realtime；账户、模型、延迟和目标地区实测后确定。

参考：[Azure主权云](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/sovereign-clouds)、[OpenAI转写](https://developers.openai.com/api/docs/guides/speech-to-text)、[TTS](https://developers.openai.com/api/docs/guides/text-to-speech)、[Realtime](https://developers.openai.com/api/docs/guides/realtime)。

| 用户与部署场景 | 当前决策 | 本项目理由 |
| --- | --- | --- |
| 海外多语言协作 | Azure Speech STT + TTS | 继续现有适配，按目标用户区域选择资源；后续评估viseme，不冒充当前已实现精确嘴型 |
| 国内用户 | 同样Azure STT + TTS | 按处理地域要求、资源资格和网络实测选择global或china部署；不能只改域名复用另一云凭据 |
| 未来海外版专属 | OpenAI转写/TTS/Realtime可选适配 | 普通听写与持续语音Agent分别接入，当前不默认调用 |

阿里云、腾讯云和Deepgram仅为前期调研材料，当前不实现相应主路或自动回退。

这是基于现有适配和产品场景的工程建议，不是准确率或价格排行榜。现有Azure适配只有录音结束后REST识别，不能据供应商支持实时就声称项目已有流式转写。

产品内语音按钮与可供本网站调用的API/SDK不同，不推断Codex/元宝/千问产品使用哪家内部识别链。浏览器Web Speech能力需逐设备检测；服务端识别与可选本地识别的可用性、语言包和音色不同，作为可选增强，不能作为所有用户一致可用的业务承诺。

## 统一接入约束

- 使用统一SpeechProvider契约，由服务端可信组织配置选择供应商/地区；不按页面语言自动决定数据处理地域。
- 浏览器采集，后端校验组织、项目和音频，再调用选定供应商；长期密钥不发给浏览器。实时直连仅使用供应商支持的短期凭据与权限边界。
- 国内外处理链路分开配置，不在失败时静默跨地区发送音频。失败保留草稿供用户核查，不自动付费重试。
- IM/邮件先验收录音结束后转写、人工修订、发送/确认；实时字幕和可打断语音Agent属于下一层验收。
- 语音与真人视频分别选型；选用语音API不代表已经获得授权数字人或视频生成能力。

## 开通后的比较方法

同一组中文、英文、中英混说、人名/项目术语、噪声、弱网和空音频样本；分别记录识别CER/WER、关键字段正确率、首字/最终结果延迟、取消与重试行为、合成可听性、音色语言适配、计费和数据保留。没有真实录音及标签时不编造准确率。

## 官方资料

- Azure语言支持：https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- Azure地区：https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions
- Azure viseme：https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme
- 阿里云ASR：https://help.aliyun.com/zh/model-studio/asr-model
- 阿里云TTS：https://help.aliyun.com/zh/model-studio/tts-model/
- 腾讯云ASR：https://cloud.tencent.com/product/asr
- 腾讯云TTS：https://cloud.tencent.com/product/tts
- Deepgram多语言：https://developers.deepgram.com/docs/nova-3-language-prompting
- 浏览器Web Speech：https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API
