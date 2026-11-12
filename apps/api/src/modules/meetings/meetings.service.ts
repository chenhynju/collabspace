import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException, ServiceUnavailableException, BadRequestException, HttpException, Optional, OnModuleInit } from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {randomUUID} from 'node:crypto';
import { PrismaService, TxClient } from '../../prisma/prisma.service';
import { ResourcePolicyService, ResourceAction } from '../groups/resource-policy.service';
import { AuditService } from '../audit/audit.service';
import { MeetingMediaService } from './meeting-media.service';
import {RealtimeEventsService} from '../realtime/realtime-events.service';
import { Meeting, meetingId, meetingInput } from './meeting-domain';

@Injectable()
export class MeetingsService implements OnModuleInit {
  private checking=false;
  private lastAccessCheck=0;
  private readonly logger=new Logger(MeetingsService.name);
  constructor(private prisma:PrismaService,private policy:ResourcePolicyService,private audit:AuditService,private media:MeetingMediaService,@Optional() private realtime?:RealtimeEventsService){}
  async onModuleInit(){await this.checkAccess();}
  private monitorHealthy(){return process.env.MEETINGS_ACCESS_MONITOR_ENABLED==='true'&&this.lastAccessCheck>0&&Date.now()-this.lastAccessCheck<90000;}
  status(){const status=this.media.status(),monitor=process.env.MEETINGS_ACCESS_MONITOR_ENABLED==='true',healthy=this.monitorHealthy();return {...status,configured:status.configured&&healthy,accessMonitorEnabled:monitor,accessMonitorHealthy:healthy,reason:status.configured&&!healthy?'会议服务器访问复核尚未就绪，暂不能入会。':null};}
  private enabled(){if(!this.media.status().enabled)throw new ServiceUnavailableException('会议功能尚未启用');}
  private async authorize(tx:TxClient,org:string,user:string,project:string,action:ResourceAction='READ'){
    // Hold shared authorization rows through the business transaction. Writes that
    // suspend the subject or archive the project serialize against these locks.
    const rows=await tx.$queryRaw<{id:string}[]>`SELECT p.id FROM prj_project p
      JOIN org_organization o ON o.id=p.organization_id
      JOIN org_membership m ON m.organization_id=o.id AND m.user_id=${user}
      JOIN sys_user u ON u.id=m.user_id
      WHERE p.id=${project} AND p.organization_id=${org} AND p.status<>'ARCHIVED'
      AND o.status='ACTIVE' AND m.status='ACTIVE' AND u.status='NORMAL'
      FOR SHARE OF p,o,m,u`;
    if(!rows.length)throw new NotFoundException('项目不存在或无权限');
    await this.policy.assert(tx,org,user,project,action);
  }
  private async load(tx:TxClient,org:string,id:string){
    const rows=await tx.$queryRaw<Meeting[]>`SELECT * FROM rtc_meeting WHERE id=${id}::uuid AND organization_id=${org} FOR UPDATE`;
    if(!rows.length)throw new NotFoundException('会议不存在或无权限');return rows[0];
  }
  list(org:string,user:string,project:string){
    this.enabled();if(typeof project!=='string'||!project||project.length>100)throw new NotFoundException('请选择项目');
    return this.prisma.withOrgUser(org,user,async tx=>{await this.authorize(tx,org,user,project);return tx.$queryRaw<Meeting[]>`SELECT * FROM rtc_meeting WHERE organization_id=${org} AND project_id=${project} ORDER BY created_at DESC,id DESC LIMIT 50`;});
  }
  create(org:string,user:string,body:any,trace:string){
    this.enabled();const input=meetingInput(body);
    return this.prisma.withOrgUser(org,user,async tx=>{
      await this.authorize(tx,org,user,input.projectId,'WRITE');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${org+':'+user+':meeting'},0))`;
      const old=await tx.$queryRaw<Meeting[]>`SELECT * FROM rtc_meeting WHERE id=${input.id}::uuid AND organization_id=${org}`;
      if(old.length){if(old[0].host_id!==user||old[0].project_id!==input.projectId||old[0].title!==input.title)throw new ConflictException('同一创建编号不能更改会议内容');return old[0];}
      const counts=await tx.$queryRaw<{n:bigint}[]>`SELECT count(*) AS n FROM rtc_meeting WHERE organization_id=${org} AND host_id=${user} AND status<>'ENDED'`;
      if(Number(counts[0].n)>=5)throw new ConflictException('请先结束已有会议，最多保留5个未结束会议');
      const inserted=await tx.$queryRaw<Meeting[]>`INSERT INTO rtc_meeting(id,organization_id,project_id,host_id,title) VALUES(${input.id}::uuid,${org},${input.projectId},${user},${input.title}) ON CONFLICT(id) DO NOTHING RETURNING *`;
      if(!inserted.length)throw new ConflictException('创建编号不可用，请使用新的编号');
      await this.audit.record(tx,{organizationId:org,actorId:user,title:'项目会议',action:'meeting:create',resourceType:'Meeting',resourceId:input.id,traceId:trace,before:null,after:{status:'ACTIVE',projectId:input.projectId}});
      return inserted[0];
    });
  }
  join(org:string,user:string,value:string){
    this.enabled();const id=meetingId(value);
    return this.prisma.withOrgUser(org,user,async tx=>{
      const meeting=await this.load(tx,org,id);await this.authorize(tx,org,user,meeting.project_id);
      if(meeting.status!=='ACTIVE')throw new ConflictException('会议已结束或正在结束');
      if(!this.monitorHealthy())throw new ServiceUnavailableException('会议服务器访问复核尚未就绪，暂不能入会');
      if(!meeting.issued_user_ids.includes(user)&&meeting.issued_user_ids.length>=25)throw new ConflictException('本会议最多签发25位成员凭证');
      const ticket=await this.media.ticket(org,id,user);
      await tx.$executeRaw`UPDATE rtc_meeting SET media_issued=true,revoked_user_ids=array_remove(revoked_user_ids,${user}),issued_user_ids=CASE WHEN ${user}=ANY(issued_user_ids) THEN issued_user_ids ELSE array_append(issued_user_ids,${user}) END WHERE id=${id}::uuid AND organization_id=${org}`;
      return ticket;
    });
  }
  @Cron('*/30 * * * * *')
  async checkAccess(){
    if(this.checking||process.env.MEETINGS_ACCESS_MONITOR_ENABLED!=='true'||!this.media.status().enabled||!this.media.status().configured)return;
    this.checking=true;
    try{
      const candidates=await this.prisma.$queryRaw<Meeting[]>`SELECT * FROM public.rtc_access_candidates()`;let complete=true;
      for(const meeting of candidates){
        if(meeting.status==='ENDING'){
          try{
            // The host's end intent is already durable. Retry confirmation after
            // transient provider failure even when that browser has gone away.
            await this.media.end(meeting.organization_id,meeting.id,meeting.issued_user_ids);
            await this.prisma.withOrg(meeting.organization_id,async tx=>{
              const changed=await tx.$queryRaw<{id:string}[]>`UPDATE rtc_meeting SET status='ENDED',ended_at=now() WHERE organization_id=${meeting.organization_id} AND id=${meeting.id}::uuid AND status='ENDING' RETURNING id`;
              if(changed.length)await this.audit.record(tx,{organizationId:meeting.organization_id,actorId:null,title:'项目会议',action:'meeting:ended',resourceType:'Meeting',resourceId:meeting.id,traceId:'rtc-end:'+randomUUID(),before:{status:'ENDING'},after:{status:'ENDED',source:'server-monitor'}});
            });
          }catch{complete=false;this.logger.warn('会议结束结果尚未确认；下次服务器复核将重试');}
          continue;
        }
        for(const user of meeting.issued_user_ids){
        if(meeting.revoked_user_ids.includes(user))continue;
        let authorized=false;
        try{authorized=await this.prisma.withOrgUser(meeting.organization_id,user,async tx=>{
          const current=await tx.$queryRaw<{status:string}[]>`SELECT status FROM rtc_meeting WHERE organization_id=${meeting.organization_id} AND id=${meeting.id}::uuid`;
          if(current[0]?.status!=='ACTIVE')return false;
          await this.authorize(tx,meeting.organization_id,user,meeting.project_id);return true;
        });}catch(error){if(!(error instanceof ForbiddenException||error instanceof NotFoundException))throw error;}
        if(authorized)continue;
        try{
          await this.media.revoke(meeting.organization_id,meeting.id,user);
          await this.prisma.withOrg(meeting.organization_id,async tx=>{
            const changed=await tx.$queryRaw<{id:string}[]>`UPDATE rtc_meeting SET revoked_user_ids=array_append(revoked_user_ids,${user}) WHERE organization_id=${meeting.organization_id} AND id=${meeting.id}::uuid AND NOT(${user}=ANY(revoked_user_ids)) RETURNING id`;
            if(changed.length)await this.audit.record(tx,{organizationId:meeting.organization_id,actorId:null,title:'会议访问复核',action:'meeting:access-revoked',resourceType:'Meeting',resourceId:meeting.id,traceId:'rtc-access:'+randomUUID(),before:{subjectUserId:user,mediaAccess:true},after:{subjectUserId:user,mediaAccess:false,source:'server-monitor'}});
          });
        }catch{complete=false;this.logger.warn('会议媒体撤权未确认；下次服务器复核将重试');}
        }
      }
      if(complete)this.lastAccessCheck=Date.now();
    }catch{this.logger.warn('会议访问复核失败；未将未知结果标记为已撤权');}
    finally{this.checking=false;}
  }
  async end(org:string,user:string,value:string,trace:string){
    this.enabled();const id=meetingId(value);
    const pending=await this.prisma.withOrgUser(org,user,async tx=>{
      const meeting=await this.load(tx,org,id);await this.authorize(tx,org,user,meeting.project_id);
      if(meeting.host_id!==user)throw new ForbiddenException('只有会议发起人可以结束会议');
      if(meeting.status==='ENDED')return meeting;
      if(meeting.status==='ACTIVE'){
        await tx.$executeRaw`UPDATE rtc_meeting SET status='ENDING' WHERE id=${id}::uuid AND organization_id=${org}`;
        await this.audit.record(tx,{organizationId:org,actorId:user,title:'项目会议',action:'meeting:ending',resourceType:'Meeting',resourceId:id,traceId:trace,before:{status:'ACTIVE'},after:{status:'ENDING'}});
      }
      return {...meeting,status:'ENDING' as const};
    });
    if(pending.status==='ENDED')return pending;
    if(pending.media_issued)await this.media.end(org,id,pending.issued_user_ids);
    return this.prisma.withOrgUser(org,user,async tx=>{
      const meeting=await this.load(tx,org,id);await this.authorize(tx,org,user,meeting.project_id);
      if(meeting.status==='ENDED')return meeting;
      const rows=await tx.$queryRaw<Meeting[]>`UPDATE rtc_meeting SET status='ENDED',ended_at=now() WHERE id=${id}::uuid AND organization_id=${org} AND status='ENDING' RETURNING *`;
      if(!rows.length)throw new ConflictException('会议状态发生变化，请刷新');
      await this.audit.record(tx,{organizationId:org,actorId:user,title:'项目会议',action:'meeting:ended',resourceType:'Meeting',resourceId:id,traceId:trace,before:{status:'ENDING'},after:{status:'ENDED'}});
      return rows[0];
    });
  }
  messages(org:string,user:string,value:string,before?:string){
    this.enabled();const id=meetingId(value);
    if(before)meetingId(before);
    return this.prisma.withOrgUser(org,user,async tx=>{
      const meeting=await this.load(tx,org,id);await this.authorize(tx,org,user,meeting.project_id);
      // Composite cursor preserves ordering even when messages share a timestamp.
      return tx.$queryRaw`SELECT id,sender_id,body,created_at FROM rtc_message WHERE organization_id=${org} AND meeting_id=${id}::uuid AND (${before||null}::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM rtc_message WHERE id=${before||null}::uuid AND organization_id=${org} AND meeting_id=${id}::uuid)) ORDER BY created_at DESC,id DESC LIMIT 100`;
    });
  }
  async sendMessage(org:string,user:string,value:string,body:any,trace:string){
    this.enabled();const id=meetingId(value),requestId=meetingId(body?.requestId);
    if(typeof body?.text!=='string'||!body.text.trim()||body.text.length>2000)throw new BadRequestException('消息需要1至2000个字符');
    const text=body.text.trim();
    let projectId='';
    const result=await this.prisma.withOrgUser(org,user,async tx=>{
      const meeting=await this.load(tx,org,id);await this.authorize(tx,org,user,meeting.project_id,'WRITE');projectId=meeting.project_id;
      const old=await tx.$queryRaw<any[]>`SELECT id,sender_id,meeting_id,body,created_at FROM rtc_message WHERE id=${requestId}::uuid AND organization_id=${org}`;
      if(old.length){if(old[0].sender_id!==user||old[0].meeting_id!==id||old[0].body!==text)throw new ConflictException('同一消息编号不能更改内容');return old[0];}
      if(meeting.status!=='ACTIVE')throw new ConflictException('会议已结束或正在结束，不能发送消息');
      const recent=await tx.$queryRaw<{n:bigint}[]>`SELECT count(*) AS n FROM rtc_message WHERE organization_id=${org} AND meeting_id=${id}::uuid AND sender_id=${user} AND created_at>now()-interval '1 minute'`;
      if(Number(recent[0].n)>=30)throw new HttpException('发送过快，请稍后重试',429);
      const rows=await tx.$queryRaw<any[]>`INSERT INTO rtc_message(id,organization_id,meeting_id,sender_id,body) VALUES(${requestId}::uuid,${org},${id}::uuid,${user},${text}) ON CONFLICT(id) DO NOTHING RETURNING id,sender_id,body,created_at`;
      if(!rows.length)throw new ConflictException('消息编号不可用');
      await this.audit.record(tx,{organizationId:org,actorId:user,title:'会议消息',action:'meeting:message',resourceType:'Meeting',resourceId:id,traceId:trace,before:null,after:{messageId:requestId}});
      return rows[0];
    });
    // Hints follow commit; clients always reauthorize and fetch authoritative history.
    try{this.realtime?.emitToProject(org,projectId,'meeting:changed',{organizationId:org,projectId,meetingId:id});}catch{}
    return result;
  }

}
