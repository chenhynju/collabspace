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
  OnModuleDestroy,
} from "@nestjs/common";
import { Store } from "@collabspace/store";
import { OrgContextGuard } from "../../common/guards/org-context.guard";
import {
  CurrentOrg,
  OrgContext,
} from "../../common/decorators/current-org.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@Controller("documents")
@UseGuards(OrgContextGuard)
export class DocumentsController implements OnModuleDestroy {
  private store = new Store();
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
  @Get() list(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Query("projectId") p: string,
  ) {
    return this.run(o, u, "list", p);
  }
  @Post() create(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Body() b: any,
  ) {
    return this.run(o, u, "create", b.projectId, b);
  }
  @Get(":id") detail(
    @CurrentOrg() o: OrgContext,
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
  ) {
    return this.run(o, u, "detail", id);
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
  ) {
    return this.run(o, u, "versions", id);
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
