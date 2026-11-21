import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  Query,
  UseGuards,
  HttpException,
  BadRequestException,
  OnModuleDestroy,
  OnModuleInit,
  UseInterceptors,
  UploadedFile,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { Store } from "@collabspace/store";
import { parseMermaid } from "@collabspace/protocol";
import { OrgContextGuard } from "../../common/guards/org-context.guard";
import {
  CurrentOrg,
  OrgContext,
} from "../../common/decorators/current-org.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AssistantService } from "../assistant/assistant.service";

@Controller("documents")
@UseGuards(OrgContextGuard)
export class DocumentsController implements OnModuleDestroy, OnModuleInit {
  private store = new Store();
  constructor(private readonly ai: AssistantService) {}
  onModuleInit() {
    return this.store.assertRuntime();
  }
  onModuleDestroy() {
    return this.store.close();
  }
  private async run(
    org: OrgContext,
    me: { id: string },
    method: string,
    ...args: any[]
  ) {
    try {
      return await this.store[method](
        { org: org.organizationId, user: me.id },
        ...args,
      );
    } catch (e: any) {
      if (e.status)
        throw new HttpException({ code: e.code, message: e.code }, e.status);
      if (e.name === "ZodError")
        throw new HttpException(
          { code: "INVALID_INPUT", message: "输入格式无效" },
          400,
        );
      throw e;
    }
  }
  @Get('mine') mine(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string}){return this.run(o,u,'mine');}
  @Get() list(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Query("projectId") p: string,
    @Query("offset") offset?: string,
    @Query("limit") limit?: string,
  ) {
    return this.run(o, u, "list", p, {offset,limit});
  }
  @Post() create(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Body() b: any,
  ) {
    return this.run(o, u, "create", b.projectId, b);
  }
  @Post("agent/draw")
  async drawDiagram(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Body() b: any,
  ) {
    const instruction = typeof b?.instruction === "string" ? b.instruction.trim() : "";
    const projectId = typeof b?.projectId === "string" ? b.projectId : "";
    if (!projectId)
      throw new BadRequestException({ code: "PROJECT_REQUIRED", message: "请指定图表所属项目。" });
    if (instruction.length < 2 || instruction.length > 500)
      throw new BadRequestException({
        code: "DRAW_INSTRUCTION_INVALID",
        message: "请用 2–500 字描述要画的图表。",
      });
    const result = await this.ai.generate(
      JSON.stringify([o.organizationId, u.id, projectId, Date.now()]),
      JSON.stringify({
        instruction:
          b?.canvas === true
            ? `${instruction}\n请只使用 flowchart TD/LR 或 mindmap；节点用 id[文字]、id{判断}、id((开始))，连线只写 --> 或 -->|标签|，不要 subgraph、样式、HTML 或额外说明。`
            : instruction,
        source: "",
      }),
      "generate-mermaid",
      `${o.organizationId}:${u.id}`,
    );
    if (result.incomplete)
      throw new HttpException(
        { code: "MERMAID_INCOMPLETE", message: "图表生成不完整，请缩短要求后重试。" },
        422,
      );
    const text = String(result.text || "")
      .replace(/^```(?:mermaid)?\s*\n?/i, "")
      .replace(/```\s*$/, "")
      .trim();
    if (
      !/^(flowchart|graph|mindmap|sequenceDiagram|classDiagram|stateDiagram|gantt|journey|timeline)\b/i.test(
        text,
      )
    )
      throw new HttpException(
        { code: "MERMAID_INVALID", message: "模型未返回有效图表源码，请调整描述后重试。" },
        422,
      );
    if (text.length > 32000 || text.includes("\0"))
      throw new HttpException({ code: "MERMAID_TOO_LARGE", message: "图表源码超出限制。" }, 422);
    if (b?.canvas === true) {
      try {
        parseMermaid(text);
      } catch {
        throw new HttpException(
          {
            code: "MERMAID_CANVAS_UNSUPPORTED",
            message: "模型结果无法转换为自由画布，请改用更简单的流程图或思维导图描述。",
          },
          422,
        );
      }
    }
    const title = String(b?.title || "").trim().slice(0, 40) || "AI 图表";
    const doc: any = await this.run(o, u, "create", projectId, {
      title,
      kind: "BOARD",
      source: text,
      canvas: b?.canvas === true,
    });
    return {
      id: doc.id,
      projectId: doc.project_id || projectId,
      title: doc.title || title,
      text,
      canvas: b?.canvas === true,
    };
  }
  @Post(":id/images")
  @UseInterceptors(FileInterceptor("file", {limits:{fileSize:5*1024*1024,files:1}}))
  imageUpload(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param("id") id:string,@UploadedFile() file:Express.Multer.File) {
    return this.run(o,u,"addImage",id,file?.buffer);
  }
  @Get(":id/images/:imageId")
  async imageRead(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param("id") id:string,@Param("imageId") imageId:string,@Res() res:Response) {
    const image=await this.run(o,u,"image",id,imageId);
    res.setHeader("Content-Type",image.mime);
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Cache-Control","no-store");
    res.setHeader("Content-Disposition","inline");
    res.send(image.bytes);
  }
  @Get(":id") detail(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
  ) {
    return this.run(o, u, "detail", id);
  }
  @Post(":id/agent/mermaid")
  async mermaidPlan(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() b: any,
  ) {
    const instruction = typeof b?.instruction === "string" ? b.instruction.trim() : "";
    if (!instruction || instruction.length > 700)
      throw new HttpException("请填写 1–700 字的图表修改要求", 400);
    const scope = await this.run(o, u, "mermaidAgentScope", id);
    const result = await this.ai.generate(
      JSON.stringify([o.organizationId, u.id, id, scope.seq]),
      JSON.stringify({ instruction, source: scope.source }),
      "generate-mermaid",
      `${o.organizationId}:${u.id}`,
    );
    const current = await this.run(o, u, "mermaidAgentScope", id);
    if (scope.seq !== current.seq) throw new HttpException("图表已变更，请重新生成", 409);
    if (result.incomplete) throw new HttpException("图表提案不完整", 422);
    if (result.truncated)
      throw new HttpException("图表源码超过 12000 字符，请分段修改后再试", 422);
    const text = result.text
      .replace(/^```(?:mermaid)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    if (
      !/^(flowchart|graph|mindmap|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|timeline|quadrantChart|C4Context|sankey|xyChart|xychart|block|packet|architecture|gitGraph|requirement)\b/i.test(
        text,
      ) ||
      text.length > 32000
    )
      throw new HttpException("模型未返回可用的 Mermaid 图表，请补充要求后重试", 422);
    return { text, before: scope.source, seq: scope.seq };
  }
  @Patch(":id") rename(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.run(o, u, "rename", id, b);
  }
  @Post(":id/archive") archive(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
  ) {
    return this.run(o, u, "archive", id);
  }
  @Post(":id/session-ticket") async ticket(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
  ) {
    return {
      ...(await this.run(o, u, "ticket", id)),
      wsUrl: process.env.COLLAB_WS_URL || "ws://localhost:3002/collab",
    };
  }
  @Get(":id/grants") grants(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
  ) {
    return this.run(o, u, "grants", id);
  }
  @Put(":id/grants") grant(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.run(o, u, "grant", id, b);
  }
  @Get(":id/threads") threads(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
  ) {
    return this.run(o, u, "threads", id);
  }
  @Post(":id/threads") thread(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.run(o, u, "thread", id, b);
  }
  @Patch(":id/threads/:thread") resolve(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Param("thread") thread: string,
    @Body() b: any,
  ) {
    return this.run(o, u, "resolve", id, thread, b);
  }
  @Post(":id/threads/:thread/replies") reply(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Param("thread") thread: string,
    @Body() b: any,
  ) {
    return this.run(o, u, "reply", id, thread, b);
  }
  @Get(":id/versions") versions(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Query("before") before?: string,
  ) {
    return this.run(o, u, "versions", id, before);
  }
  @Post(":id/versions") version(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body() b: any,
  ) {
    return this.run(o, u, "version", id, b);
  }
  @Get(":id/versions/:version") preview(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Param("version") v: string,
  ) {
    return this.run(o, u, "preview", id, v);
  }
  @Post(":id/versions/:version/restore-copy") restore(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Param("version") v: string,
    @Body() b: any,
  ) {
    return this.run(o, u, "restore", id, v, b);
  }
}
