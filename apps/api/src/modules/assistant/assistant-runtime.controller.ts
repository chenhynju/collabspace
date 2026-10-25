import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { OrgContextGuard } from '../../common/guards/org-context.guard';
import { CurrentOrg, OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssistantRuntimeService } from './assistant-runtime.service';
import type { Request } from 'express';
@Controller('assistant/runs')
@UseGuards(OrgContextGuard)
export class AssistantRuntimeController {
 constructor(private runtime:AssistantRuntimeService){}
 @Post() start(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Body() b:any,@Req() r:Request){return this.runtime.start(o.organizationId,u.id,b,r.traceId);}
 @Get(':id') get(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string){return this.runtime.get(o.organizationId,u.id,id);}
 @Delete(':id') cancel(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string){return this.runtime.cancel(o.organizationId,u.id,id);}
}
