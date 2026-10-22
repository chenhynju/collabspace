export const diagramShapes = [
  {
    "key": "process",
    "shape": "rect",
    "name": "处理",
    "group": "流程"
  },
  {
    "key": "decision",
    "shape": "diam",
    "name": "判断",
    "group": "流程"
  },
  {
    "key": "start",
    "shape": "circle",
    "name": "起止",
    "group": "流程"
  },
  {
    "key": "terminal",
    "shape": "stadium",
    "name": "开始结束",
    "group": "流程"
  },
  {
    "key": "subprocess",
    "shape": "fr-rect",
    "name": "子流程",
    "group": "流程"
  },
  {
    "key": "document",
    "shape": "doc",
    "name": "文档",
    "group": "流程"
  },
  {
    "key": "documents",
    "shape": "docs",
    "name": "多文档",
    "group": "流程"
  },
  {
    "key": "data",
    "shape": "lean-r",
    "name": "输入输出",
    "group": "流程"
  },
  {
    "key": "manual",
    "shape": "sl-rect",
    "name": "手工输入",
    "group": "流程"
  },
  {
    "key": "preparation",
    "shape": "hex",
    "name": "准备",
    "group": "流程"
  },
  {
    "key": "delay",
    "shape": "delay",
    "name": "延时",
    "group": "流程"
  },
  {
    "key": "stored",
    "shape": "stored-data",
    "name": "存储数据",
    "group": "数据"
  },
  {
    "key": "database",
    "shape": "cyl",
    "name": "数据库",
    "group": "数据"
  },
  {
    "key": "disk",
    "shape": "disk",
    "name": "磁盘",
    "group": "数据"
  },
  {
    "key": "queue",
    "shape": "h-cyl",
    "name": "消息队列",
    "group": "数据"
  },
  {
    "key": "cloud",
    "shape": "cloud",
    "name": "云服务",
    "group": "架构"
  },
  {
    "key": "service",
    "shape": "rounded",
    "name": "应用服务",
    "group": "架构"
  },
  {
    "key": "junction",
    "shape": "fork",
    "name": "分叉合并",
    "group": "流程"
  },
  {
    "key": "end",
    "shape": "dbl-circ",
    "name": "终止",
    "group": "流程"
  },
  {
    "key": "note",
    "shape": "notch-rect",
    "name": "说明",
    "group": "基础"
  },
  {
    "key": "person",
    "shape": "sm-circ",
    "name": "连接点",
    "group": "基础"
  },
  {
    "key": "triangle",
    "shape": "tri",
    "name": "三角形",
    "group": "基础"
  },
  {
    "key": "event",
    "shape": "hex",
    "name": "事件",
    "group": "架构"
  },
  {
    "key": "display",
    "shape": "curv-trap",
    "name": "显示输出",
    "group": "流程"
  }
] as const;
export type DiagramShape = typeof diagramShapes[number]["key"];

export const diagramTemplates = [
  {
    "name": "流程图",
    "category": "业务流程",
    "source": "flowchart LR\n  A[需求] --> B{评审通过?}\n  B -->|是| C[交付]\n  B -->|否| A"
  },
  {
    "name": "审批与退回",
    "category": "业务流程",
    "source": "flowchart TD\n  A@{ shape: stadium, label: \"发起申请\" }\n  B@{ shape: doc, label: \"申请材料\" }\n  C{主管审批}\n  D@{ shape: cyl, label: \"归档记录\" }\n  A --> B --> C\n  C -->|通过| D\n  C -->|补充材料| B"
  },
  {
    "name": "跨部门泳道",
    "category": "业务流程",
    "source": "flowchart LR\n  subgraph Sales[销售]\n    A[客户需求]\n    B[确认报价]\n  end\n  subgraph Delivery[交付]\n    C[评估方案]\n    D[实施验收]\n  end\n  subgraph Finance[财务]\n    E[回款核销]\n  end\n  A --> C --> B --> D --> E"
  },
  {
    "name": "组织架构",
    "category": "团队规划",
    "source": "flowchart TD\n  A[负责人] --> B[产品团队]\n  A --> C[技术团队]\n  A --> D[运营团队]\n  C --> E[前端]\n  C --> F[后端]\n  C --> G[质量保障]"
  },
  {
    "name": "思维导图",
    "category": "团队规划",
    "source": "mindmap\n  root((远程协作))\n    文档\n      实时编辑\n      评论\n    团队\n      在线状态"
  },
  {
    "name": "系统架构",
    "category": "技术设计",
    "source": "flowchart LR\n  U[用户] --> W[Web应用]\n  W --> A[API服务]\n  W <-->|实时协作| S[WebSocket]\n  A --> P@{ shape: cyl, label: \"PostgreSQL\" }\n  A --> R@{ shape: h-cyl, label: \"Redis缓存\" }\n  S --> P\n  S --> R"
  },
  {
    "name": "网络部署",
    "category": "技术设计",
    "source": "flowchart TB\n  U[互联网用户] --> E[入口代理]\n  subgraph Public[入口层]\n    E\n    F[访问防护]\n  end\n  subgraph Private[私有服务网]\n    A[应用实例A]\n    B[应用实例B]\n    D[(数据库)]\n  end\n  E --> F\n  F --> A & B\n  A & B --> D"
  },
  {
    "name": "时序图",
    "category": "技术设计",
    "source": "sequenceDiagram\n  participant U as 用户\n  participant A as 应用\n  participant D as 数据库\n  U->>A: 提交修改\n  A->>D: 持久化事务\n  D-->>A: 提交成功\n  alt 保存成功\n    A-->>U: 返回确认\n  else 保存失败\n    A-->>U: 保留本地草稿\n  end"
  },
  {
    "name": "类图",
    "category": "技术设计",
    "source": "classDiagram\n  class Document {\n    +String title\n    +save()\n  }\n  class Member\n  Member --> Document : edits"
  },
  {
    "name": "状态图",
    "category": "业务流程",
    "source": "stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review: 提交\n  Review --> Published: 通过\n  Review --> Draft: 退回\n  Published --> Archived: 归档"
  },
  {
    "name": "ER图",
    "category": "技术设计",
    "source": "erDiagram\n  ORGANIZATION ||--o{ DOCUMENT : owns\n  DOCUMENT ||--o{ COMMENT : contains\n  DOCUMENT {\n    string id PK\n    string title\n    string organization_id FK\n  }\n  COMMENT {\n    string id PK\n    string document_id FK\n    string content\n  }"
  },
  {
    "name": "项目甘特图",
    "category": "团队规划",
    "source": "gantt\n  title 项目交付计划\n  dateFormat YYYY-MM-DD\n  section 需求与设计\n  需求确认 :a, 2026-11-01, 3d\n  方案设计 :b, after a, 4d\n  section 开发与验收\n  开发实现 :c, after b, 7d\n  验收交付 :after c, 3d"
  },
  {
    "name": "客户旅程",
    "category": "业务分析",
    "source": "journey\n  title 客户交付旅程\n  section 发现\n    了解产品: 4: 客户\n    提交需求: 3: 客户,顾问\n  section 交付\n    共同评审: 4: 客户,顾问\n    验收上线: 5: 客户,工程师"
  },
  {
    "name": "里程碑时间线",
    "category": "团队规划",
    "source": "timeline\n  title 产品演进\n  需求阶段 : 客户访谈 : 确认范围\n  开发阶段 : 核心实现 : 集成验收\n  上线阶段 : 灰度发布 : 复盘改进"
  },
  {
    "name": "投入分布饼图",
    "category": "业务分析",
    "source": "pie title 项目投入分布\n  \"产品设计\" : 20\n  \"研发实现\" : 50\n  \"质量保障\" : 20\n  \"交付运维\" : 10"
  },
  {
    "name": "优先级四象限",
    "category": "业务分析",
    "source": "quadrantChart\n  title 需求优先级\n  x-axis 低投入 --> 高投入\n  y-axis 低价值 --> 高价值\n  quadrant-1 重点规划\n  quadrant-2 优先执行\n  quadrant-3 暂缓\n  quadrant-4 谨慎评估\n  协作可靠性: [0.3, 0.9]\n  视觉优化: [0.4, 0.6]\n  小众集成: [0.8, 0.2]"
  },
  {
    "name": "Git发布流程",
    "category": "技术设计",
    "source": "gitGraph\n  commit id: \"基础版本\"\n  branch develop\n  checkout develop\n  commit id: \"功能实现\"\n  checkout main\n  merge develop\n  commit id: \"发布\""
  },
  {
    "name": "问题根因分析",
    "category": "业务分析",
    "source": "flowchart LR\n  A[人员与培训] --> P[交付延期]\n  B[流程与沟通] --> P\n  C[技术与环境] --> P\n  D[外部依赖] --> P\n  A1[职责不清] --> A\n  B1[评审滞后] --> B\n  C1[测试不足] --> C\n  D1[接口变更] --> D"
  },
  {
    "name": "C4系统上下文",
    "category": "技术设计",
    "source": "C4Context\n  title 协作平台上下文\n  Person(u, \"团队成员\", \"共同创作\")\n  System(a, \"协作平台\", \"文档与图表\")\n  System_Ext(e, \"通知服务\", \"邮件提醒\")\n  Rel(u, a, \"编辑与讨论\")\n  Rel(a, e, \"发送通知\")"
  },
  {
    "name": "团队看板",
    "category": "团队规划",
    "source": "kanban\n  backlog[待办]\n    task1[需求评审]\n  work[进行中]\n    task2[接口开发]\n  done[已完成]\n    task3[项目初始化]"
  },
  {
    "name": "交付趋势",
    "category": "业务分析",
    "source": "xychart-beta\n  title \"每周交付\"\n  x-axis [W1, W2, W3, W4]\n  y-axis \"任务数\" 0 --> 40\n  bar [12, 20, 18, 32]\n  line [10, 18, 25, 30]"
  },
  {
    "name": "业务流量桑基图",
    "category": "业务分析 · 英文标签",
    "source": "sankey-beta\n\nDemand,Development,20\nDevelopment,Testing,15\nDevelopment,Rework,5\nTesting,Release,12\nTesting,Rework,3"
  },
  {
    "name": "产品用例概览",
    "category": "业务流程",
    "source": "flowchart LR\n  U((普通成员))\n  O((项目负责人))\n  subgraph Product[协作平台]\n    A([编辑文档])\n    B([讨论评论])\n    C([管理授权])\n    D([恢复版本])\n  end\n  U --> A & B\n  O --> A & B & C & D"
  },
  {
    "name": "工作分解WBS",
    "category": "团队规划",
    "source": "mindmap\n  root((产品交付))\n    需求与设计\n      需求访谈\n      交互设计\n    工程实现\n      前端界面\n      后端接口\n      数据存储\n    验收上线\n      回归测试\n      用户验收\n      发布复盘"
  }
] as const;
