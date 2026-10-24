import { Injectable, HttpException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ResourcePolicyService } from '../groups/resource-policy.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { OrgContext } from '../../common/decorators/current-org.decorator';
import { hasPermission } from '../../common/util/perms';
import { z } from 'zod';

export const projectMailInput = z.object({
  projectId:z.string().min(1).max(128), requestId:z.string().uuid(), confirmed:z.literal(true),
  to:z.string().trim().email().max(254), subject:z.string().trim().min(1).max(160).regex(/^[^\r\n]+$/),
  text:z.string().trim().min(1).max(10000),
}).strict();

@Injectable()
export class ProjectMailService {
  constructor(private prisma:PrismaService,private policy:ResourcePolicyService,private mail:MailService,private audit:AuditService) {}
  get ready(){return this.mail.isLive;}
  async send(org:OrgContext,user:{id:string},body:unknown,traceId:string) {
    const parsed=projectMailInput.safeParse(body);
    if(!parsed.success)throw new HttpException('请检查收件人、主题、正文并确认发送',400);
    const b=parsed.data;
    if(!hasPermission(org.perms,'invite:send')&&!org.roleKeys.some(r=>['OWNER','ADMIN'].includes(r)))throw new HttpException('仅组织管理员或有邀请发送权限的成员可发信',403);
    if(!this.mail.isLive)throw new HttpException('未配置真实邮件服务，邮件没有发出',503);
    const hash=createHash('sha256').update(JSON.stringify([b.projectId,b.to,b.subject,b.text])).digest('hex');
    const claimed=await this.prisma.withOrg(org.organizationId,async tx=>{
      await this.policy.assert(tx,org.organizationId,user.id,b.projectId,'WRITE');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${org.organizationId+':'+user.id+':project-mail'}))`;
      const previous=await tx.$queryRaw<any[]>`SELECT * FROM assistant_mail_attempt WHERE organization_id=${org.organizationId} AND actor_id=${user.id} AND id=${b.requestId}::uuid`;
      if(previous.length){
        const r=previous[0];if(r.payload_hash!==hash)throw new HttpException('该发送编号已绑定其他内容，请重新预览',409);
        if(r.status==='ACCEPTED')return {send:false,id:r.provider_id,status:r.status};
        if(new Date(r.created_at).getTime()<Date.now()-23*3600000)throw new HttpException('重试已超过安全时间，请先核查邮件服务记录，避免重复外发',409);
        if(new Date(r.updated_at).getTime()>Date.now()-60000)throw new HttpException('发送仍在处理中，请一分钟后检查记录',409);
        await tx.$executeRaw`UPDATE assistant_mail_attempt SET status='SENDING',updated_at=now() WHERE organization_id=${org.organizationId} AND actor_id=${user.id} AND id=${b.requestId}::uuid`;
        return {send:true};
      }
      const counts=await tx.$queryRaw<any[]>`SELECT count(*)::int AS n FROM assistant_mail_attempt WHERE organization_id=${org.organizationId} AND actor_id=${user.id} AND created_at>now()-interval '1 hour'`;
      if(counts[0].n>=20)throw new HttpException('每个组织用户每小时最多20封邮件',429);
      await tx.$executeRaw`INSERT INTO assistant_mail_attempt(id,organization_id,actor_id,project_id,payload_hash) VALUES(${b.requestId}::uuid,${org.organizationId},${user.id},${b.projectId},${hash})`;
      await this.audit.record(tx,{organizationId:org.organizationId,actorId:user.id,title:'确认项目邮件',action:'assistant:mail:confirmed',resourceType:'Project',resourceId:b.projectId,traceId,after:{requestId:b.requestId}});
      return {send:true};
    });
    if(!claimed.send)return {status:claimed.status,id:claimed.id,requestId:b.requestId};
    // Durable intent precedes external effect. Same provider key for every retry; never auto-retry.
    try {
      const receipt=await this.mail.sendProjectEmail(b.to,b.subject,b.text,createHash('sha256').update(org.organizationId+':'+user.id+':'+b.requestId).digest('hex'));
      if(receipt.provider!=='resend'||!receipt.id)throw new Error('NO_RECEIPT');
      await this.prisma.withOrg(org.organizationId,async tx=>{
        await tx.$executeRaw`UPDATE assistant_mail_attempt SET status='ACCEPTED',provider_id=${receipt.id},updated_at=now() WHERE organization_id=${org.organizationId} AND actor_id=${user.id} AND id=${b.requestId}::uuid`;
        await this.audit.record(tx,{organizationId:org.organizationId,actorId:user.id,title:'项目邮件已受理',action:'assistant:mail:accepted',resourceType:'Project',resourceId:b.projectId,traceId,after:{requestId:b.requestId,providerId:receipt.id}});
      });
      return {status:'ACCEPTED',id:receipt.id,requestId:b.requestId};
    }catch{
      await this.prisma.withOrg(org.organizationId,tx=>tx.$executeRaw`UPDATE assistant_mail_attempt SET status='UNKNOWN',updated_at=now() WHERE organization_id=${org.organizationId} AND actor_id=${user.id} AND id=${b.requestId}::uuid AND status<>'ACCEPTED'`).catch(()=>{});
      throw new HttpException('发送结果待核查，可能已受理；请保留相同内容与编号，一分钟后重试，勿新建重复邮件',502);
    }
  }
  async list(org:OrgContext,user:{id:string},projectId:string) {
    return this.prisma.withOrg(org.organizationId,async tx=>{
      await this.policy.assert(tx,org.organizationId,user.id,projectId,'READ');
      return tx.$queryRaw`SELECT id,status,provider_id,created_at,updated_at FROM assistant_mail_attempt WHERE organization_id=${org.organizationId} AND actor_id=${user.id} AND project_id=${projectId} ORDER BY created_at DESC LIMIT 20`;
    });
  }
}
