import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { ResourcePolicyService } from "../groups/resource-policy.service";
import { AuditService } from "../audit/audit.service";
import { hasPermission } from "../../common/util/perms";
import type { OrgContext } from "../../common/decorators/current-org.decorator";

type ActionMethod = "POST" | "PATCH" | "DELETE" | "NAVIGATE";
export type AgentAction = {
  id: string;
  tool: string;
  label: string;
  detail: string;
  method: ActionMethod;
  path: string;
  body?: Record<string, unknown>;
  permission?: string;
  risk: "low" | "medium" | "high";
};
type Snapshot = {
  workspaces: any[];
  projects: any[];
  tasks: any[];
  members: any[];
  roles: any[];
  invitations: any[];
  files: any[];
};
type Plan = {
  reply: string;
  source: "rules" | "model";
  actions?: AgentAction[];
  data?: Record<string, unknown>;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "进行中",
  DELIVERED: "已交付",
  ARCHIVED: "已归档",
};
const TASK_LABEL: Record<string, string> = {
  TODO: "待办",
  IN_PROGRESS: "进行中",
  DONE: "已完成",
};
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "管理员",
  MEMBER: "成员",
  GUEST: "访客",
  FINANCE: "财务",
};
const READ_WORDS = /列出|查看|有哪些|多少|显示|查询|list|show|what|which/i;

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ResourcePolicyService,
    private readonly audit: AuditService,
  ) {}

  async chat(
    org: OrgContext,
    user: { id: string; email?: string },
    body: any,
    traceId: string,
    ip?: string,
  ): Promise<Plan> {
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 500)
      throw new BadRequestException({
        code: "AGENT_MESSAGE_INVALID",
        message: "请输入 1–500 字的指令。",
      });
    const granted = org.roleKeys.includes("OWNER") ? ["*"] : org.perms;
    const allow = (permission: string) => hasPermission(granted, permission);
    const snapshot = await this.load(org, user.id, allow);
    let plan = this.rulePlan(message, snapshot, allow);
    if (!plan) plan = await this.modelPlan(message, snapshot, allow);
    try {
      await this.prisma.withOrg(org.organizationId, (tx) =>
        this.audit.record(tx, {
          organizationId: org.organizationId,
          actorId: user.id,
          title: "AI 工作助理",
          action: "agent:chat",
          resourceType: "AgentSession",
          traceId,
          ip,
          requestMethod: "POST",
          after: {
            source: plan.source,
            actions: (plan.actions ?? []).map((action) => action.tool),
            replyLength: plan.reply.length,
          },
        }),
      );
    } catch {
      /* 审计失败不阻断对话；审计服务自身记录错误。 */
    }
    return plan;
  }

  private async load(
    org: OrgContext,
    userId: string,
    allow: (permission: string) => boolean,
  ): Promise<Snapshot> {
    return this.prisma.withOrg(org.organizationId, async (tx) => {
      const canResolveProjects =
        allow("project:list") || allow("task:manage") || allow("file:manage");
      const accessible = canResolveProjects
        ? await this.policy.accessible(tx, org.organizationId, userId, "READ")
        : [];
      const workspaces = allow("workspace:list")
        ? await tx.workspace.findMany({
            where: { organizationId: org.organizationId },
            include: { _count: { select: { projects: true } } },
            orderBy: { createdAt: "asc" },
          })
        : [];
      const projects = canResolveProjects
        ? await tx.project.findMany({
            where: {
              organizationId: org.organizationId,
              id: { in: accessible },
            },
            include: {
              workspace: { select: { id: true, name: true } },
              owner: { select: { id: true, name: true } },
              _count: { select: { tasks: true, files: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 200,
          })
        : [];
      const projectIds = projects.map((project) => project.id);
      const tasks = projectIds.length
        ? await tx.task.findMany({
            where: { organizationId: org.organizationId, projectId: { in: projectIds } },
            include: {
              assignee: { select: { id: true, name: true } },
              project: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 300,
          })
        : [];
      const members = allow("member:list")
        ? await tx.membership.findMany({
            where: { organizationId: org.organizationId, status: { not: "REMOVED" } },
            include: {
              user: { select: { id: true, name: true, email: true, status: true } },
              roles: { include: { role: { select: { key: true, name: true } } } },
            },
            orderBy: { joinedAt: "asc" },
          })
        : [];
      const roles = allow("invite:send")
        ? await tx.role.findMany({
            where: { organizationId: org.organizationId, status: "NORMAL" },
            select: { id: true, key: true, name: true },
          })
        : [];
      const invitations = allow("invite:list")
        ? await tx.invitation.findMany({
            where: { organizationId: org.organizationId },
            include: { role: { select: { key: true, name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : [];
      const files =
        allow("file:manage") && projectIds.length
          ? await tx.file.findMany({
              where: { organizationId: org.organizationId, projectId: { in: projectIds } },
              include: { project: { select: { id: true, name: true } } },
              orderBy: { createdAt: "desc" },
              take: 100,
            })
          : [];
      return { workspaces, projects, tasks, members, roles, invitations, files };
    });
  }

  private rulePlan(
    message: string,
    snapshot: Snapshot,
    allow: (permission: string) => boolean,
  ): Plan | null {
    const text = message.trim();
    const lower = text.toLowerCase();

    if (/^(你好|hi|hello|嗨|在吗)/i.test(text)) return this.welcome();

    const quoted = this.quotes(text);
    const projectName =
      this.nameAfter(text, "项目") ?? /(?:项目)\s*[：:]\s*([^\s，,。]+)/.exec(text)?.[1] ?? null;
    const workspaceName = this.nameAfter(text, "工作区");

    /* ---------- 工作区：新建 / 改名 / 删除 ---------- */
    if (/(?:新建|创建|添加|建一个)\s*(?:一个)?\s*工作区/.test(text)) {
      if (!allow("workspace:add")) return this.denied("创建工作区", "workspace:add");
      const name =
        workspaceName ??
        this.afterCommand(text, /(?:新建|创建|添加|建一个)\s*(?:一个)?\s*工作区\s*/);
      if (!name) return this.clarify("请告诉我要创建的工作区名称，例如：新建工作区「客户 A」。");
      const exists = snapshot.workspaces.find(
        (workspace) => workspace.name.toLowerCase() === name.toLowerCase(),
      );
      if (exists) return this.clarify(`工作区「${name}」已经存在。`);
      return {
        reply: `准备创建 1 个工作区。确认后会立即写入当前组织，并记录审计。`,
        source: "rules",
        actions: [
          this.action(
            "create_workspace",
            `新建工作区「${name}」`,
            "工作区用于分组项目；创建后可在项目空间继续新建项目。",
            "POST",
            "/workspaces",
            { name },
            "workspace:add",
            "medium",
          ),
        ],
      };
    }
    if (/(改名|重命名|更名为)/.test(text) && /工作区/.test(text)) {
      if (!allow("workspace:edit")) return this.denied("修改工作区", "workspace:edit");
      const target = this.resolve(snapshot.workspaces, workspaceName ?? quoted[0]);
      if (!target.one) return this.ambiguous("工作区", target.matches);
      const newName = quoted[quoted.length - 1];
      if (!newName || newName === target.one.name)
        return this.clarify("请按「把工作区『原名』改名为『新名称』」的格式再试一次。");
      return {
        reply: `准备把工作区「${target.one.name}」改名为「${newName}」。`,
        source: "rules",
        actions: [
          this.action(
            "rename_workspace",
            `重命名工作区「${target.one.name}」`,
            `新名称：${newName}`,
            "PATCH",
            `/workspaces/${target.one.id}`,
            { name: newName },
            "workspace:edit",
            "medium",
          ),
        ],
      };
    }
    if (/(删除|移除)/.test(text) && /工作区/.test(text)) {
      if (!allow("workspace:remove")) return this.denied("删除工作区", "workspace:remove");
      const target = this.resolve(snapshot.workspaces, workspaceName ?? quoted[0]);
      if (!target.one) return this.ambiguous("工作区", target.matches);
      if ((target.one._count?.projects ?? 0) > 0)
        return this.clarify(
          `工作区「${target.one.name}」还有 ${target.one._count.projects} 个项目，请先删除或移出项目。服务端也会拒绝非空工作区删除。`,
        );
      return {
        reply: `准备删除空工作区「${target.one.name}」。此操作不可撤销。`,
        source: "rules",
        actions: [
          this.action(
            "delete_workspace",
            `删除工作区「${target.one.name}」`,
            "仅空工作区可删除；已检查当前项目数为 0。",
            "DELETE",
            `/workspaces/${target.one.id}`,
            undefined,
            "workspace:remove",
            "high",
          ),
        ],
      };
    }

    /* ---------- 项目：新建 / 改名 / 生命周期 / 删除 ---------- */
    if (/(?:新建|创建|添加|建一个)\s*(?:一个)?\s*项目/.test(text)) {
      if (!allow("project:add")) return this.denied("创建项目", "project:add");
      let name = projectName;
      if (!name) {
        const rest = this.afterCommand(text, /(?:新建|创建|添加|建一个)\s*(?:一个)?\s*项目\s*/);
        name = rest
          ? rest
              .replace(/^[「『"“]|[」』"”]$/g, "")
              .split(/(?:到|在|至|归属|工作区)/)[0]
              .trim()
          : null;
      }
      if (!name) return this.clarify("请告诉我要创建的项目名称，例如：新建项目「官网改版」。");
      let workspace =
        (workspaceName && this.resolve(snapshot.workspaces, workspaceName).one) ??
        (quoted.length > 1
          ? snapshot.workspaces.find((row) => row.name === quoted[quoted.length - 1])
          : null);
      if (!workspace && snapshot.workspaces.length === 1) workspace = snapshot.workspaces[0];
      if (!workspace)
        return this.clarify(
          `请指定所属工作区。当前可用工作区：${snapshot.workspaces.map((row) => `「${row.name}」`).join("、") || "（暂无）"}。`,
        );
      return {
        reply: `准备在「${workspace.name}」下创建项目「${name}」，初始状态为草稿。`,
        source: "rules",
        actions: [
          this.action(
            "create_project",
            `新建项目「${name}」`,
            `所属工作区：${workspace.name}；创建后可在项目空间启动或补充任务。`,
            "POST",
            "/projects",
            { name, workspaceId: workspace.id, description: "" },
            "project:add",
            "medium",
          ),
        ],
      };
    }
    if (/(改名|重命名|更名为)/.test(text) && /项目/.test(text)) {
      if (!allow("project:edit")) return this.denied("修改项目", "project:edit");
      const target = this.resolve(snapshot.projects, projectName ?? quoted[0]);
      if (!target.one) return this.ambiguous("项目", target.matches);
      const newName = quoted[quoted.length - 1];
      if (!newName || newName === target.one.name)
        return this.clarify("请按「把项目『原名』改名为『新名称』」的格式再试一次。");
      return {
        reply: `准备把项目「${target.one.name}」改名为「${newName}」。`,
        source: "rules",
        actions: [
          this.action(
            "rename_project",
            `重命名项目「${target.one.name}」`,
            `新名称：${newName}`,
            "PATCH",
            `/projects/${target.one.id}`,
            { name: newName },
            "project:edit",
            "medium",
          ),
        ],
      };
    }
    const lifecycle = text.match(/(启动|激活|交付|归档|删除)\s*(?:项目)?/);
    if (lifecycle && /项目/.test(text)) {
      const keyword = lifecycle[1];
      const target = this.resolve(snapshot.projects, projectName ?? quoted[0]);
      if (!target.one) return this.ambiguous("项目", target.matches);
      const project = target.one;
      const spec =
        keyword === "启动" || keyword === "激活"
          ? {
              method: "POST" as const,
              suffix: "activate",
              label: "启动",
              permission: "project:edit",
              from: ["DRAFT"],
            }
          : keyword === "交付"
            ? {
                method: "POST" as const,
                suffix: "deliver",
                label: "交付",
                permission: "project:deliver",
                from: ["ACTIVE"],
              }
            : keyword === "归档"
              ? {
                  method: "POST" as const,
                  suffix: "archive",
                  label: "归档",
                  permission: "project:edit",
                  from: ["ACTIVE", "DELIVERED"],
                }
              : {
                  method: "DELETE" as const,
                  suffix: "",
                  label: "删除",
                  permission: "project:remove",
                  from: ["DRAFT"],
                };
      if (!allow(spec.permission)) return this.denied(`${spec.label}项目`, spec.permission);
      if (!spec.from.includes(project.status))
        return this.clarify(
          `项目「${project.name}」当前是「${STATUS_LABEL[project.status] ?? project.status}」，不能执行「${spec.label}」。允许的前置状态：${spec.from.map((status) => STATUS_LABEL[status]).join("、")}。`,
        );
      return {
        reply:
          spec.method === "DELETE"
            ? `准备删除草稿项目「${project.name}」。此操作不可撤销。`
            : `准备把项目「${project.name}」从「${STATUS_LABEL[project.status]}」变更为「${spec.label === "交付" ? "已交付" : spec.label === "归档" ? "已归档" : "进行中"}」。`,
        source: "rules",
        actions: [
          this.action(
            `${spec.label}_project`,
            `${spec.label}项目「${project.name}」`,
            `当前状态：${STATUS_LABEL[project.status]}。服务端会再次校验状态机与权限。`,
            spec.method,
            spec.suffix ? `/projects/${project.id}/${spec.suffix}` : `/projects/${project.id}`,
            undefined,
            spec.permission,
            spec.method === "DELETE" ? "high" : "medium",
          ),
        ],
      };
    }

    /* ---------- Office / 文件上传 ---------- */
    const officeMatch = text.match(
      /(?:新建|创建|添加)\s*(?:一个|一份|一张)?\s*(word|excel|ppt|powerpoint|office)(?:\s*文档)?/i,
    );
    if (officeMatch) {
      if (!allow("file:manage")) return this.denied("新建 Office", "file:manage");
      const rawKind = officeMatch[1].toLowerCase();
      const extension =
        rawKind === "excel" ? "xlsx" : rawKind === "ppt" || rawKind === "powerpoint" ? "pptx" : "docx";
      const label = extension === "xlsx" ? "Excel" : extension === "pptx" ? "PowerPoint" : "Word";
      const title = this.nameAfter(text, "文档") ?? quoted.find((name) => name !== projectName);
      if (!title)
        return this.clarify(`请告诉我要创建的 ${label} 标题，例如：新建 ${label}「季度报告」到项目「官网改版」。`);
      const projectTarget = projectName
        ? this.resolve(snapshot.projects, projectName)
        : {
            one: snapshot.projects.length === 1 ? snapshot.projects[0] : null,
            matches: snapshot.projects,
          };
      if (!projectTarget.one)
        return this.clarify(
          `请指定 Office 所属项目。当前可访问项目：${snapshot.projects.map((row) => `「${row.name}」`).join("、") || "（暂无）"}。`,
        );
      return {
        reply: `准备在项目「${projectTarget.one.name}」中新建 ${label}「${title}」，创建后直接打开编辑器。`,
        source: "rules",
        actions: [
          this.action(
            "create_office",
            `新建 ${label}「${title}」`,
            `所属项目：${projectTarget.one.name}；使用现有 Office 服务创建，重复确认不会重复新建。`,
            "POST",
            "/office/create",
            {
              projectId: projectTarget.one.id,
              title,
              extension,
              requestId: randomUUID(),
            },
            "file:manage",
            "medium",
          ),
        ],
      };
    }

    if (/(上传|导入)/.test(text) && /(文件|附件)/.test(text) && !READ_WORDS.test(text)) {
      if (!allow("file:manage")) return this.denied("上传文件", "file:manage");
      const projectTarget = projectName
        ? this.resolve(snapshot.projects, projectName)
        : {
            one: snapshot.projects.length === 1 ? snapshot.projects[0] : null,
            matches: snapshot.projects,
          };
      if (!projectTarget.one)
        return this.clarify(
          `请指定文件所属项目，例如：上传文件到项目「官网改版」。当前可访问项目：${snapshot.projects.map((row) => `「${row.name}」`).join("、") || "（暂无）"}。`,
        );
      return {
        reply: `准备上传文件到项目「${projectTarget.one.name}」。请先在下方选择本地文件，再确认执行。`,
        source: "rules",
        actions: [
          this.action(
            "upload_file",
            `上传文件到「${projectTarget.one.name}」`,
            "选择不超过 20MB 的本地文件；同名文件会自动生成新版本，上传后可在附件中查看。",
            "POST",
            "/files/upload",
            { projectId: projectTarget.one.id },
            "file:manage",
            "medium",
          ),
        ],
      };
    }

    /* ---------- 文档 / 白板 ---------- */
    const contentMatch = text.match(/(?:新建|创建|添加)\s*(?:一个)?\s*(文档|白板)/);
    if (contentMatch && /项目/.test(text)) {
      if (!allow("project:list")) return this.denied("新建协作内容", "project:list");
      const kind = contentMatch[1] === "白板" ? "BOARD" : "DOCUMENT";
      const label = contentMatch[1];
      const title =
        this.nameAfter(text, "文档") ??
        this.nameAfter(text, "白板") ??
        this.afterCommand(text, /(?:新建|创建|添加)\s*(?:一个)?\s*(?:文档|白板)\s*/);
      if (!title)
        return this.clarify(`请告诉我要创建的${label}标题，例如：新建${label}「项目周报」。`);
      const projectTarget = projectName
        ? this.resolve(snapshot.projects, projectName)
        : {
            one: snapshot.projects.length === 1 ? snapshot.projects[0] : null,
            matches: snapshot.projects,
          };
      if (!projectTarget.one)
        return this.clarify(
          `请指定${label}所属项目。当前可访问项目：${snapshot.projects.map((row) => `「${row.name}」`).join("、") || "（暂无）"}。`,
        );
      return {
        reply: `准备在项目「${projectTarget.one.name}」中新建${label}「${title}」，创建后直接打开编辑器。`,
        source: "rules",
        actions: [
          this.action(
            "create_content",
            `新建${label}「${title}」`,
            `所属项目：${projectTarget.one.name}；内容创建成功后自动跳转。`,
            "POST",
            "/documents",
            { projectId: projectTarget.one.id, title, kind },
            "project:list",
            "medium",
          ),
        ],
      };
    }

    /* ---------- 图表 / 画图 ---------- */
    const drawKind = /(思维导图|架构图|时序图|甘特图|流程图|图表)/.exec(text)?.[1];
    const wantsDraw =
      !!drawKind &&
      /(画|绘制|生成|做|来|设计)/.test(text) &&
      !/(查看|列出|打开|删除|改名|重命名|移动)/.test(text);
    if (wantsDraw) {
      if (!allow("project:list")) return this.denied("生成图表", "project:list");
      const projectTarget = projectName
        ? this.resolve(snapshot.projects, projectName)
        : {
            one: snapshot.projects.length === 1 ? snapshot.projects[0] : null,
            matches: snapshot.projects,
          };
      if (!projectTarget.one)
        return this.clarify(
          `请指定图表所属项目，例如：给项目「官网改版」画${drawKind}。当前可访问项目：${
            snapshot.projects.map((row) => `「${row.name}」`).join("、") || "（暂无）"
          }。`,
        );
      const title = `${drawKind} · ${text.replace(/\s+/g, " ").slice(0, 20)}`.slice(0, 40);
      const canvas = drawKind === "流程图" || drawKind === "思维导图";
      return {
        reply: `准备在项目「${projectTarget.one.name}」中生成${drawKind}「${title}」，确认后会调用模型并直接打开${canvas ? "可拖拽的自由画布" : "白板"}。`,
        source: "rules",
        actions: [
          this.action(
            "draw_diagram",
            `生成${drawKind}「${title}」`,
            `所属项目：${projectTarget.one.name}；生成后可继续在画布中拖拽、改字或连线。`,
            "POST",
            "/documents/agent/draw",
            { projectId: projectTarget.one.id, title, instruction: text, canvas },
            "project:list",
            "medium",
          ),
        ],
      };
    }

    /* ---------- 任务 ---------- */
    if (/(新建|创建|添加|加个|加一个)/.test(text) && /任务/.test(text)) {
      if (!allow("task:manage")) return this.denied("创建任务", "task:manage");
      const title = this.nameAfter(text, "任务");
      if (!title)
        return this.clarify(
          "请告诉我要创建的任务标题，例如：给项目「官网改版」添加任务「首页设计」。",
        );
      const projectTarget = projectName
        ? this.resolve(snapshot.projects, projectName)
        : {
            one: snapshot.projects.length === 1 ? snapshot.projects[0] : null,
            matches: snapshot.projects,
          };
      if (!projectTarget.one)
        return this.clarify(
          `请指定任务所属项目。当前可访问项目：${snapshot.projects.map((row) => `「${row.name}」`).join("、") || "（暂无）"}。`,
        );
      const assigneeName = this.nameAfter(text, "指派给") ?? this.nameAfter(text, "负责人");
      let assigneeId: string | undefined;
      if (assigneeName) {
        const member = this.resolve(
          snapshot.members,
          assigneeName,
          (row) => `${row.user?.name ?? ""} ${row.user?.email ?? ""}`,
        );
        if (!member.one) return this.ambiguous("成员", member.matches);
        assigneeId = member.one.userId;
      }
      return {
        reply: `准备在项目「${projectTarget.one.name}」中创建任务「${title}」${assigneeName ? `，指派给 ${assigneeName}` : ""}。`,
        source: "rules",
        actions: [
          this.action(
            "create_task",
            `新建任务「${title}」`,
            `所属项目：${projectTarget.one.name}${assigneeName ? `；负责人：${assigneeName}` : "；暂不指派"}。`,
            "POST",
            "/tasks",
            { projectId: projectTarget.one.id, title, ...(assigneeId ? { assigneeId } : {}) },
            "task:manage",
            "medium",
          ),
        ],
      };
    }
    if (/任务/.test(text) && /(完成|进行中|开始|待办|重置|状态)/.test(text)) {
      if (!allow("task:manage")) return this.denied("更新任务", "task:manage");
      const title = this.nameAfter(text, "任务");
      if (!title) return this.clarify("请告诉我是哪个任务，例如：把任务「首页设计」标记完成。");
      const status = /(完成|done)/i.test(text)
        ? "DONE"
        : /(开始|进行中|in_progress)/i.test(text)
          ? "IN_PROGRESS"
          : "TODO";
      const projectTarget = projectName ? this.resolve(snapshot.projects, projectName) : null;
      if (projectTarget && !projectTarget.one) return this.ambiguous("项目", projectTarget.matches);
      const pool = projectTarget?.one
        ? snapshot.tasks.filter((task) => task.projectId === projectTarget.one.id)
        : snapshot.tasks;
      const target = this.resolve(pool, title);
      if (!target.one)
        return this.clarify(
          `没有找到唯一的任务「${title}」。请补充项目名，例如：把项目「官网改版」的任务「首页设计」标记完成。`,
        );
      return {
        reply: `准备把任务「${target.one.title}」更新为「${TASK_LABEL[status]}」。`,
        source: "rules",
        actions: [
          this.action(
            "update_task",
            `更新任务「${target.one.title}」`,
            `项目：${target.one.project?.name ?? "未知"}；目标状态：${TASK_LABEL[status]}。`,
            "PATCH",
            `/tasks/${target.one.id}`,
            { status },
            "task:manage",
            "medium",
          ),
        ],
      };
    }

    /* ---------- 邀请与成员状态 ---------- */
    if (/邀请/.test(text)) {
      if (!allow("invite:send")) return this.denied("发送邀请", "invite:send");
      const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
      if (!email) return this.clarify("请提供受邀邮箱，例如：邀请 alice@example.com 为成员。");
      const roleToken =
        /(OWNER|ADMIN|MEMBER|GUEST|FINANCE)/i.exec(text)?.[1]?.toUpperCase() ??
        Object.entries({ 管理员: "ADMIN", 成员: "MEMBER", 访客: "GUEST", 财务: "FINANCE" }).find(
          ([label]) => text.includes(label),
        )?.[1] ??
        "MEMBER";
      if (roleToken === "OWNER")
        return this.clarify("邀请不能直接授予 OWNER；请通过成员管理完成所有者转让。");
      const role = snapshot.roles.find((row) => row.key === roleToken);
      if (!role)
        return this.clarify(
          `当前组织没有可用的「${roleToken}」角色。可用角色：${snapshot.roles.map((row) => `${row.name}(${row.key})`).join("、")}。`,
        );
      return {
        reply: `准备邀请 ${email} 加入当前组织，角色为「${role.name}」。邀请有效期与邮件发送沿用现有邀请流程。`,
        source: "rules",
        actions: [
          this.action(
            "invite_member",
            `邀请 ${email}`,
            `角色：${role.name}；接受前不会增加成员席位。`,
            "POST",
            "/invitations",
            { email, roleId: role.id },
            "invite:send",
            "medium",
          ),
        ],
      };
    }
    if (/成员/.test(text) && /(停用|暂停|移除|删除|恢复|重新启用|启用)/.test(text)) {
      if (!allow("member:remove")) return this.denied("调整成员状态", "member:remove");
      const who = quoted[0] ?? this.afterCommand(text, /(?:成员)\s*/);
      if (!who) return this.clarify("请告诉我要调整的成员姓名或邮箱。");
      const target = this.resolve(
        snapshot.members,
        who,
        (row) => `${row.user?.name ?? ""} ${row.user?.email ?? ""}`,
      );
      if (!target.one) return this.ambiguous("成员", target.matches);
      const member = target.one;
      const restore = /(恢复|重新启用|启用)/.test(text);
      const remove = /(移除|删除)/.test(text);
      if (!restore && member.roles?.some((row: any) => row.role?.key === "OWNER")) {
        const otherOwners = snapshot.members.filter(
          (row) =>
            row.id !== member.id &&
            row.status === "ACTIVE" &&
            row.roles?.some((role: any) => role.role?.key === "OWNER"),
        );
        if (!otherOwners.length)
          return this.clarify(
            "不能停用或移除最后一个有效 OWNER。请先转让所有者角色。服务端也会拒绝此操作。",
          );
      }
      const name = member.user?.name ?? member.user?.email ?? who;
      return {
        reply: restore
          ? `准备恢复成员「${name}」的组织访问。`
          : `准备${remove ? "移除" : "停用"}成员「${name}」。${
              remove ? "移除后其后续请求将失效。" : "停用后其后续请求将失效，可稍后恢复。"
            }`,
        source: "rules",
        actions: [
          this.action(
            restore ? "reactivate_member" : remove ? "remove_member" : "suspend_member",
            `${restore ? "恢复" : remove ? "移除" : "停用"}成员「${name}」`,
            `当前状态：${member.status}；此操作会立即影响该成员的后续请求。`,
            restore ? "POST" : remove ? "DELETE" : "POST",
            restore
              ? `/members/${member.id}/reactivate`
              : remove
                ? `/members/${member.id}`
                : `/members/${member.id}/suspend`,
            undefined,
            "member:remove",
            "high",
          ),
        ],
      };
    }

    /* ---------- 读取 ---------- */
    if (/能力|能做什么|帮助|help|怎么用/.test(lower)) return this.welcome();

    if (READ_WORDS.test(text) && /工作区/.test(text)) {
      if (!allow("workspace:list")) return this.denied("查看工作区", "workspace:list");
      return {
        reply: snapshot.workspaces.length
          ? `当前组织有 ${snapshot.workspaces.length} 个工作区：\n${snapshot.workspaces
              .map(
                (workspace) =>
                  `• ${workspace.name} · ${workspace._count?.projects ?? 0} 个项目${workspace.description ? ` · ${workspace.description}` : ""}`,
              )
              .join("\n")}`
          : "当前组织还没有工作区。",
        source: "rules",
      };
    }
    if (READ_WORDS.test(text) && /成员/.test(text)) {
      if (!allow("member:list")) return this.denied("查看成员", "member:list");
      const active = snapshot.members.filter((member) => member.status === "ACTIVE");
      return {
        reply: snapshot.members.length
          ? `当前组织有 ${active.length} 位有效成员（共 ${snapshot.members.length} 条记录）：\n${snapshot.members
              .slice(0, 20)
              .map(
                (member) =>
                  `• ${member.user?.name ?? "未命名"} · ${member.user?.email ?? ""} · ${
                    member.roles?.map((row: any) => row.role?.name ?? row.role?.key).join("/") ||
                    "无角色"
                  } · ${member.status}`,
              )
              .join("\n")}${snapshot.members.length > 20 ? "\n…" : ""}`
          : "当前没有可查看的成员。",
        source: "rules",
      };
    }
    if (READ_WORDS.test(text) && /邀请/.test(text)) {
      if (!allow("invite:list")) return this.denied("查看邀请", "invite:list");
      return {
        reply: snapshot.invitations.length
          ? `最近 ${snapshot.invitations.length} 条邀请：\n${snapshot.invitations
              .map(
                (invitation) =>
                  `• ${invitation.email} · ${invitation.role?.name ?? invitation.role?.key} · ${invitation.status}`,
              )
              .join("\n")}`
          : "当前组织还没有邀请记录。",
        source: "rules",
      };
    }
    if (READ_WORDS.test(text) && /任务/.test(text)) {
      if (!allow("task:manage")) return this.denied("查看任务", "task:manage");
      const projectTarget = projectName ? this.resolve(snapshot.projects, projectName) : null;
      if (projectTarget && !projectTarget.one) return this.ambiguous("项目", projectTarget.matches);
      const rows = projectTarget?.one
        ? snapshot.tasks.filter((task) => task.projectId === projectTarget.one.id)
        : snapshot.tasks;
      return {
        reply: rows.length
          ? `${projectTarget?.one ? `项目「${projectTarget.one.name}」的` : ""}任务（${rows.length}）：\n${rows
              .slice(0, 20)
              .map(
                (task) =>
                  `• ${task.title} · ${TASK_LABEL[task.status] ?? task.status}${task.assignee ? ` · @${task.assignee.name}` : ""}${projectTarget?.one ? "" : ` · ${task.project?.name ?? ""}`}`,
              )
              .join("\n")}${rows.length > 20 ? "\n…" : ""}`
          : "没有匹配的任务。",
        source: "rules",
      };
    }
    if (READ_WORDS.test(text) && /文件|附件/.test(text)) {
      if (!allow("file:manage")) return this.denied("查看文件", "file:manage");
      return {
        reply: snapshot.files.length
          ? `最近 ${snapshot.files.length} 个文件：\n${snapshot.files
              .slice(0, 20)
              .map((file) => `• ${file.name} · ${file.project?.name ?? "项目"} · v${file.version}`)
              .join("\n")}`
          : "当前组织还没有可查看的文件。",
        source: "rules",
      };
    }
    if (READ_WORDS.test(text) && /项目/.test(text)) {
      if (!allow("project:list")) return this.denied("查看项目", "project:list");
      const projectTarget = projectName ? this.resolve(snapshot.projects, projectName) : null;
      if (projectTarget && !projectTarget.one) return this.ambiguous("项目", projectTarget.matches);
      if (projectTarget?.one) {
        const project = projectTarget.one;
        const tasks = snapshot.tasks.filter((task) => task.projectId === project.id);
        return {
          reply: `项目「${project.name}」\n• 状态：${STATUS_LABEL[project.status] ?? project.status}\n• 工作区：${project.workspace?.name ?? "-"}\n• 负责人：${project.owner?.name ?? "-"}\n• 任务：${tasks.filter((task) => task.status === "TODO").length} 待办 / ${tasks.filter((task) => task.status === "IN_PROGRESS").length} 进行中 / ${tasks.filter((task) => task.status === "DONE").length} 已完成\n• 文件：${project._count?.files ?? 0} 个`,
          source: "rules",
        };
      }
      return {
        reply: snapshot.projects.length
          ? `当前组织有 ${snapshot.projects.length} 个可访问项目：\n${snapshot.projects
              .slice(0, 20)
              .map(
                (project) =>
                  `• ${project.name} · ${STATUS_LABEL[project.status] ?? project.status} · ${project.workspace?.name ?? "-"} · ${project._count?.tasks ?? 0} 任务 / ${project._count?.files ?? 0} 文件`,
              )
              .join("\n")}${snapshot.projects.length > 20 ? "\n…" : ""}`
          : "当前组织还没有可访问项目。",
        source: "rules",
      };
    }

    /* ---------- 导航 ---------- */
    if (/打开|进入|跳转|去/.test(text)) {
      const nav = [
        { keys: ["协作空间", "协作"], path: "/collaboration" },
        { keys: ["项目空间", "项目列表"], path: "/projects" },
        { keys: ["消息", "IM", "聊天"], path: "/im" },
        { keys: ["附件", "文件"], path: "/files" },
        { keys: ["成员"], path: "/members" },
        { keys: ["邀请"], path: "/invitations" },
        { keys: ["审计"], path: "/audit" },
        { keys: ["概览", "首页"], path: "/dashboard" },
      ].find((item) => item.keys.some((key) => text.toLowerCase().includes(key.toLowerCase())));
      if (/项目/.test(text) && projectName) {
        const target = this.resolve(snapshot.projects, projectName);
        if (!target.one) return this.ambiguous("项目", target.matches);
        return {
          reply: `正在打开项目「${target.one.name}」。`,
          source: "rules",
          actions: [
            this.action(
              "open_project",
              `打开「${target.one.name}」`,
              "跳转到项目详情与任务看板。",
              "NAVIGATE",
              `/projects/${target.one.id}`,
              undefined,
              undefined,
              "low",
            ),
          ],
        };
      }
      if (nav)
        return {
          reply: "正在为你打开。",
          source: "rules",
          actions: [
            this.action(
              "navigate",
              "打开页面",
              nav.path,
              "NAVIGATE",
              nav.path,
              undefined,
              undefined,
              "low",
            ),
          ],
        };
    }

    return null;
  }

  /** 无规则命中时：有模型则用只读问答，否则给出可用指令。 */
  private async modelPlan(
    message: string,
    snapshot: Snapshot,
    allow: (permission: string) => boolean,
  ): Promise<Plan> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return this.welcome("没有匹配到可执行指令。");
    const facts = {
      projects: snapshot.projects.slice(0, 30).map((project) => ({
        name: project.name,
        status: STATUS_LABEL[project.status] ?? project.status,
        workspace: project.workspace?.name,
        tasks: project._count?.tasks ?? 0,
        files: project._count?.files ?? 0,
      })),
      workspaces: snapshot.workspaces.map((workspace) => workspace.name),
      visibleCapabilities: {
        projects: allow("project:list"),
        tasks: allow("task:manage"),
        invitations: allow("invite:send"),
        members: allow("member:list"),
        files: allow("file:manage"),
      },
    };
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          max_tokens: 300,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "你是 CollabSpace 工作助理。只依据给定快照回答问题，不声称已执行任何写操作，不编造项目或人员。用户要执行写操作时，提示可用中文指令，例如：新建工作区「名称」、新建项目「名称」到工作区「名称」、把项目「名称」启动、给项目「名称」添加任务「标题」、邀请 a@b.com 为成员。用中文纯文本回答，最多 150 字。",
            },
            {
              role: "user",
              content: `快照：${JSON.stringify(facts)}\n\n用户：${message}`,
            },
          ],
        }),
      });
      if (!response.ok) throw new Error("model unavailable");
      const data: any = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) throw new Error("empty model reply");
      return { reply: text.trim().slice(0, 600), source: "model" };
    } catch {
      return this.welcome("我暂时无法理解这条指令，也没有调用模型成功。");
    }
  }

  private welcome(prefix = ""): Plan {
    return {
      reply: `${prefix}${prefix ? "\n\n" : ""}我可以直接操作当前组织的工作区、项目、任务、邀请和成员状态。试试这些指令：
• 列出项目 / 列出成员 / 列出工作区
• 新建工作区「客户 A」
• 新建项目「官网改版」到工作区「客户 A」
• 把项目「官网改版」启动、交付或归档
• 给项目「官网改版」添加任务「首页设计」指派给 张三
• 把任务「首页设计」标记完成
• 新建文档「项目周报」到项目「官网改版」
• 新建 Word「季度报告」到项目「官网改版」
• 上传文件到项目「官网改版」
• 给项目「官网改版」画一个三步审批流程图
• 邀请 alice@example.com 为成员
• 停用或恢复成员「李四」

写操作会先给出计划，只有你确认后才会调用现有接口；权限仍由服务端校验。`,
      source: "rules",
    };
  }

  private denied(what: string, permission: string): Plan {
    return {
      reply: `当前角色没有「${what}」权限（需要 ${permission}）。可以请组织管理员操作，或切换到有权限的组织。`,
      source: "rules",
    };
  }

  private clarify(reply: string): Plan {
    return { reply, source: "rules" };
  }

  private ambiguous(label: string, matches: any[]): Plan {
    const names = matches
      .map((row) => row.name ?? row.title ?? row.user?.name ?? row.id)
      .slice(0, 8);
    return {
      reply: names.length
        ? `找到多个${label}：${names.map((name) => `「${name}」`).join("、")}。请写得更具体一些。`
        : `没有找到匹配的${label}。请检查名称或先刷新页面。`,
      source: "rules",
    };
  }

  private action(
    tool: string,
    label: string,
    detail: string,
    method: ActionMethod,
    path: string,
    body: Record<string, unknown> | undefined,
    permission: string | undefined,
    risk: "low" | "medium" | "high",
  ): AgentAction {
    return {
      id: `${tool}-${Math.random().toString(36).slice(2, 8)}`,
      tool,
      label,
      detail,
      method,
      path,
      ...(body ? { body } : {}),
      ...(permission ? { permission } : {}),
      risk,
    };
  }

  private quotes(text: string) {
    return Array.from(text.matchAll(/[「『“"]([^」』”"]{1,64})[」』”"]/g)).map((match) =>
      match[1].trim(),
    );
  }

  private nameAfter(text: string, keyword: string) {
    const match = new RegExp(`${keyword}\\s*[「『“"]([^」』”"]{1,64})[」』”"]`).exec(text);
    return match?.[1]?.trim() ?? null;
  }

  private afterCommand(text: string, pattern: RegExp) {
    const rest = text.replace(pattern, "").trim();
    if (!rest) return null;
    return (
      rest
        .replace(/^[「『“"]/, "")
        .split(/[」』”"，,。；;\n]/)[0]
        .replace(/(?:到|在|至)工作区.*$/, "")
        .replace(/(?:请|谢谢|一下)$/g, "")
        .trim() || null
    );
  }

  private resolve<T extends Record<string, any>>(
    rows: T[],
    name: string | null | undefined,
    text?: (row: T) => string,
  ): { one: T | null; matches: T[] } {
    if (!name) return { one: null, matches: rows.slice(0, 8) };
    const term = name.trim().toLowerCase();
    const get = (row: T) => (text ? text(row) : String(row.name ?? row.title ?? "")).toLowerCase();
    const exact = rows.filter((row) => get(row) === term);
    if (exact.length === 1) return { one: exact[0], matches: exact };
    if (exact.length > 1) return { one: null, matches: exact };
    const partial = rows.filter((row) => get(row).includes(term));
    if (partial.length === 1) return { one: partial[0], matches: partial };
    return { one: null, matches: partial.length ? partial : [] };
  }
}
