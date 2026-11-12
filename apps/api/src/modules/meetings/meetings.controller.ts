import { Body, Controller, Get, Post, Param, Query, Req, UseGuards, Header } from '@nestjs/common';
import type { Request } from 'express';
import { OrgContextGuard } from '../../common/guards/org-context.guard';
import { CurrentOrg, OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MeetingsService } from './meetings.service';
import { MeetingMediaService } from './meeting-media.service';

@Controller('meetings')
@UseGuards(OrgContextGuard)
export class MeetingsController {
 constructor(private meetings:MeetingsService,private media:MeetingMediaService){}
 @Get('status') status(){return this.meetings.status();}
 @Get() list(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Query('projectId') p:string){return this.meetings.list(o.organizationId,u.id,p);}
 @Post() create(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Body() b:any,@Req() r:Request){return this.meetings.create(o.organizationId,u.id,b,r.traceId);}
 @Post(':id/join') @Header('Cache-Control','no-store')
 join(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string){return this.meetings.join(o.organizationId,u.id,id);}
 @Post(':id/end') end(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Req() r:Request){return this.meetings.end(o.organizationId,u.id,id,r.traceId);}
 @Get(':id/messages') messages(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Query('before') before?:string){return this.meetings.messages(o.organizationId,u.id,id,before);}
 @Post(':id/messages') sendMessage(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Body() b:any,@Req() r:Request){return this.meetings.sendMessage(o.organizationId,u.id,id,b,r.traceId);}

}
