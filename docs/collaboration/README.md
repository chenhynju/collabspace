# CollabSpace 文档索引

> 更新：2026-11-21 ｜ 当前主线文档优先于历史记录与 evidence 中的旧结论。

## 推荐阅读路径

| 读者 | 先读 | 再读 |
| --- | --- | --- |
| 面试官 / 评审 | [README](../../README.md) → [功能归档](FEATURE-ARCHIVE.md) | [需求分析](REQUIREMENTS.md) → [详细设计](DESIGN.md) |
| 产品 / 需求 | [需求分析](REQUIREMENTS.md) | [功能归档](FEATURE-ARCHIVE.md) → 专项设计 |
| 开发 | [开发者导读](DEVELOPER-GUIDE.zh-CN.md) | [详细设计](DESIGN.md) → [ADR](ADR.md) |
| 使用者 / 运维 | [用户手册](USER-OPERATIONS-MANUAL.md) | [第三方服务](THIRD-PARTY-SERVICES.md) |
| 安全 / 权限评审 | [详细设计](DESIGN.md) 第 3、5 章 | [ADR](ADR.md)、审计与发布 evidence |

## 现行主线文档

| 文档 | 用途 | 维护要求 |
| --- | --- | --- |
| [REQUIREMENTS.md](REQUIREMENTS.md) | 用户、场景、范围、BR、AT、指标 | 范围变化时更新 |
| [DESIGN.md](DESIGN.md) | 架构、模块、数据、安全、实时、AI、语音、部署 | 架构或关键流程变化时更新 |
| [FEATURE-ARCHIVE.md](FEATURE-ARCHIVE.md) | 已完成功能、状态、证据、限制 | 每个功能完成/状态变化时更新 |
| [USER-OPERATIONS-MANUAL.md](USER-OPERATIONS-MANUAL.md) | 使用、管理、排障、演示、运维 | 界面或流程变化时更新 |
| [DEVELOPER-GUIDE.zh-CN.md](DEVELOPER-GUIDE.zh-CN.md) | 目录地图、从需求找代码、本地验证 | 目录/命令变化时更新 |
| [ADR.md](ADR.md) | 关键架构决策与取舍 | 新决策时追加 |
| [README.md](../../README.md) | 项目入口、亮点、快速开始、状态 | 发布或定位变化时更新 |

## 专项设计（现行参考）

| 主题 | 文档 |
| --- | --- |
| 白板 / Mermaid / 图表 | [WHITEBOARD.md](WHITEBOARD.md)、[MERMAID.md](MERMAID.md)、[MERMAID-POSITION.md](MERMAID-POSITION.md)、[DIAGRAMS.md](DIAGRAMS.md)、[BUSINESS-DIAGRAMS.md](BUSINESS-DIAGRAMS.md) |
| Office / 文件 | [COLLABORATIVE-FILES.md](COLLABORATIVE-FILES.md)、[OFFICE-PARITY.md](OFFICE-PARITY.md)、[OFFICE-IMAGE-PREPARATION.md](OFFICE-IMAGE-PREPARATION.md) |
| 文档 / 富文本 / 版本 | [RICH_TEXT.md](RICH_TEXT.md)、[SNAPSHOT-TIMELINE.md](SNAPSHOT-TIMELINE.md)、[MARKDOWN-IMPLEMENTATION.md](MARKDOWN-IMPLEMENTATION.md) |
| AI / Agent | [ASSISTANT.md](ASSISTANT.md)、[AGENT-OFFICE-WHITEBOARD.md](AGENT-OFFICE-WHITEBOARD.md) |
| 语音 / 数字人 | [VOICE-PERSONA.md](VOICE-PERSONA.md)、[SPEECH-PROVIDER-SELECTION.md](SPEECH-PROVIDER-SELECTION.md)、[DIGITAL-HUMAN-DESIGN.md](DIGITAL-HUMAN-DESIGN.md) |
| 会议（生产关闭） | [MEETINGS.md](MEETINGS.md) |
| 第三方服务 | [THIRD-PARTY-SERVICES.md](THIRD-PARTY-SERVICES.md)、[THIRD-PARTY-SETUP-RTC-VOICE-PERSONA.md](THIRD-PARTY-SETUP-RTC-VOICE-PERSONA.md) |
| 界面 / 工作区 | [UI-REFRESH.md](UI-REFRESH.md)、[WORKSPACE-UX.md](WORKSPACE-UX.md)、[UNIFIED-WORKSPACE.md](UNIFIED-WORKSPACE.md) |

## 历史归档

[archive/](archive/) 保存旧状态、交接、WIP 与逐日需求/设计快照。它们用于追溯，**不作为当前验收依据**。归档索引见 [archive/README.md](archive/README.md)。

## 文档维护规则

1. 功能完成并通过验收后，先更新 [FEATURE-ARCHIVE.md](FEATURE-ARCHIVE.md)，再更新 README 状态。
2. 新决策写入 [ADR.md](ADR.md)，不要只藏在聊天或提交说明里。
3. 验收结论必须有可打开的证据；未运行、未配置、失败项保留原状态。
4. 点时间文档（状态、交接、WIP）完成使命后移入 `archive/`，不继续堆在现行目录。
5. 涉及权限、资金、外发、供应商调用时，明确写出“已验证/未验证/不可用”，不用模糊措辞。
