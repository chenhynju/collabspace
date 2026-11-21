import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OrgContextGuard } from "../../common/guards/org-context.guard";
import { CurrentOrg, OrgContext } from "../../common/decorators/current-org.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ResourcePolicyService } from "../groups/resource-policy.service";
import { hasPermission } from "../../common/util/perms";

export type SearchResult = {
  id: string;
  type: "workspace" | "project" | "document" | "task" | "file";
  title: string;
  subtitle: string;
  href: string;
  updatedAt: string;
};

@Controller("search")
@UseGuards(OrgContextGuard)
export class SearchController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ResourcePolicyService,
  ) {}

  @Get()
  search(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: { id: string },
    @Query("q") raw?: string,
  ) {
    const query = typeof raw === "string" ? raw.trim() : "";
    if (!query || query.length > 80)
      throw new BadRequestException({ code: "SEARCH_QUERY_INVALID", message: "请输入 1–80 字的搜索内容。" });
    const granted = org.roleKeys.includes("OWNER") ? ["*"] : org.perms;
    const allow = (permission: string) => hasPermission(granted, permission);
    return this.prisma.withOrg(org.organizationId, async (tx) => {
      const accessible = await this.policy.accessible(tx, org.organizationId, user.id, "READ");
      const text = { contains: query, mode: "insensitive" as const };
      const [workspaces, projects, documents, tasks, files] = await Promise.all([
        allow("workspace:list")
          ? tx.workspace.findMany({
              where: {
                organizationId: org.organizationId,
                OR: [{ name: text }, { description: text }],
              },
              select: { id: true, name: true, updatedAt: true },
              orderBy: { updatedAt: "desc" },
              take: 8,
            })
          : [],
        accessible.length
          ? tx.project.findMany({
              where: {
                organizationId: org.organizationId,
                id: { in: accessible },
                OR: [{ name: text }, { description: text }],
              },
              select: {
                id: true,
                name: true,
                updatedAt: true,
                workspace: { select: { name: true } },
              },
              orderBy: { updatedAt: "desc" },
              take: 8,
            })
          : [],
        accessible.length
          ? tx.collabDocument.findMany({
              where: {
                organizationId: org.organizationId,
                projectId: { in: accessible },
                title: text,
                grants: { some: { userId: user.id } },
              },
              select: {
                id: true,
                projectId: true,
                title: true,
                kind: true,
                updatedAt: true,
                project: { select: { name: true } },
              },
              orderBy: { updatedAt: "desc" },
              take: 8,
            })
          : [],
        allow("task:manage") && accessible.length
          ? tx.task.findMany({
              where: {
                organizationId: org.organizationId,
                projectId: { in: accessible },
                OR: [{ title: text }, { description: text }],
              },
              select: {
                id: true,
                projectId: true,
                title: true,
                status: true,
                updatedAt: true,
                project: { select: { name: true } },
              },
              orderBy: { updatedAt: "desc" },
              take: 8,
            })
          : [],
        allow("file:manage") && accessible.length
          ? tx.file.findMany({
              where: { organizationId: org.organizationId, projectId: { in: accessible }, name: text },
              select: {
                id: true,
                name: true,
                version: true,
                createdAt: true,
                project: { select: { name: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 8,
            })
          : [],
      ]);
      const results: SearchResult[] = [
        ...workspaces.map((row) => ({
          id: row.id,
          type: "workspace" as const,
          title: row.name,
          subtitle: "工作区",
          href: `/projects?workspace=${row.id}`,
          updatedAt: row.updatedAt.toISOString(),
        })),
        ...projects.map((row) => ({
          id: row.id,
          type: "project" as const,
          title: row.name,
          subtitle: `项目 · ${row.workspace.name}`,
          href: `/projects/${row.id}`,
          updatedAt: row.updatedAt.toISOString(),
        })),
        ...documents.map((row) => ({
          id: row.id,
          type: "document" as const,
          title: row.title,
          subtitle: `${row.kind === "BOARD" ? "白板" : row.kind === "OFFICE" ? "Office" : "文档"} · ${row.project.name}`,
          href:
            row.kind === "OFFICE"
              ? `/office/${row.id}`
              : `/projects/${row.projectId}/documents/${row.id}`,
          updatedAt: row.updatedAt.toISOString(),
        })),
        ...tasks.map((row) => ({
          id: row.id,
          type: "task" as const,
          title: row.title,
          subtitle: `任务 · ${row.project.name} · ${row.status === "DONE" ? "已完成" : row.status === "IN_PROGRESS" ? "进行中" : "待办"}`,
          href: `/projects/${row.projectId}`,
          updatedAt: row.updatedAt.toISOString(),
        })),
        ...files.map((row) => ({
          id: row.id,
          type: "file" as const,
          title: row.name,
          subtitle: `附件 · ${row.project.name} · v${row.version}`,
          href: "/files",
          updatedAt: row.createdAt.toISOString(),
        })),
      ];
      results.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      return { query, total: results.length, results };
    });
  }
}
