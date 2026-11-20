import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrgContextGuard } from "../../common/guards/org-context.guard";
import { CurrentOrg, OrgContext } from "../../common/decorators/current-org.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AgentService } from "./agent.service";

@Controller("agent")
@UseGuards(OrgContextGuard)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  /** 能力清单只描述可用范围；实际权限在每次对话与既有接口上校验。 */
  @Get("capabilities")
  capabilities(@CurrentOrg() org: OrgContext) {
    return {
      modelPlanning: !!process.env.DEEPSEEK_API_KEY,
      tools: [
        "list_workspaces",
        "create_workspace",
        "rename_workspace",
        "delete_workspace",
        "list_projects",
        "create_project",
        "rename_project",
        "project_lifecycle",
        "delete_project",
        "list_tasks",
        "create_task",
        "update_task",
        "create_content",
        "list_members",
        "invite_member",
        "suspend_member",
        "reactivate_member",
        "remove_member",
        "list_files",
        "list_invitations",
        "navigate",
      ],
      permissions: {
        roleKeys: org.roleKeys,
        canAddProject: org.roleKeys.includes("OWNER") || org.perms.includes("project:add"),
      },
    };
  }

  @Post("chat")
  chat(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: { id: string; email?: string },
    @Body() body: any,
    @Req() request: Request,
  ) {
    return this.agent.chat(org, user, body, request.traceId, request.ip);
  }
}
