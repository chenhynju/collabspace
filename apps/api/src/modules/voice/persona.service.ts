import {Injectable,NotFoundException,ConflictException,ServiceUnavailableException,HttpException,BadRequestException} from '@nestjs/common';
import {PrismaService,TxClient} from '../../prisma/prisma.service';
import {AuditService} from '../audit/audit.service';
import {CHARACTER_CATALOG,appearanceInput} from '@collabspace/protocol/personas';
import {Cron,CronExpression} from '@nestjs/schedule';
import {randomUUID} from 'crypto';
import {CONSENT_VERSION,sourceDraft} from './persona-domain';

@Injectable()
export class PersonaService {
 constructor(private prisma:PrismaService,private audit:AuditService){}
 capabilities(){return {identity:'human',consentVersion:CONSENT_VERSION,draftStorage:'private',maxBytes:20971520,sourceKinds:['PHOTO','VIDEO'],retention:{accessDays:7,scheduledPurge:process.env.PERSONA_PURGE_ENABLED==='true'},creation:{configured:false,reason:'真人创建服务尚未接入；可保存私有素材草稿，不会发送到供应商'},preciseVisemes:false};}
 @Cron(CronExpression.EVERY_HOUR)
 async purgeExpired(){
  if(process.env.PERSONA_PURGE_ENABLED!=='true')return;
  // The restricted definer function can only remove expired drafts in bounded batches.
  // This is maintenance, never an organization-less business read.
  return this.prisma.$queryRaw<{removed:number}[]>`SELECT public.purge_expired_persona_drafts() AS removed`;
 }
 async agent(org:string,user:string){return this.prisma.withOrgUser(org,user,async tx=>{await this.member(tx,org,user);const rows=await tx.$queryRaw<any[]>`SELECT preset_id,revision FROM persona_agent_config WHERE organization_id=${org} AND agent_key='assistant'`;return {agentKey:'assistant',presetId:rows[0]?.preset_id||'lan-v1',revision:rows[0]?.revision||0,mode:'preset',customizationAvailable:false,catalog:CHARACTER_CATALOG.map(c=>({...c,modelAvailable:false})),planned:{male:10,female:10},reason:'固定外观稿可选择；可动3D和捏脸仍待正式模型制作验证'};});}
 async configureAgent(org:string,user:string,body:any,trace:string){
  let input:ReturnType<typeof appearanceInput>;try{input=appearanceInput(body);}catch(error){throw new BadRequestException((error as Error).message);}
  return this.prisma.withOrgUser(org,user,async tx=>{await this.member(tx,org,user);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${org+':agent-persona'},0))`;const rows=await tx.$queryRaw<any[]>`SELECT revision,preset_id FROM persona_agent_config WHERE organization_id=${org} AND agent_key='assistant'`;
   if((rows[0]?.revision||0)!==input.revision)throw new ConflictException('配置已被另一管理员修改，请刷新');
   await tx.$executeRaw`INSERT INTO persona_agent_config(organization_id,agent_key,preset_id,updated_by) VALUES(${org},'assistant',${input.presetId},${user}) ON CONFLICT(organization_id,agent_key) DO UPDATE SET preset_id=EXCLUDED.preset_id,revision=persona_agent_config.revision+1,updated_by=EXCLUDED.updated_by,updated_at=now()`;
   await this.audit.record(tx,{organizationId:org,actorId:user,title:'Agent形象配置',action:'persona:agent-config',resourceType:'AgentPersona',resourceId:'assistant',traceId:trace,before:rows[0]||null,after:{presetId:input.presetId,revision:input.revision+1}});return {presetId:input.presetId,revision:input.revision+1};
  });
 }
 private async member(tx:TxClient,org:string,user:string){
  if(!await tx.membership.findFirst({where:{organizationId:org,userId:user,status:'ACTIVE',user:{status:'NORMAL'},organization:{status:'ACTIVE'}}}))throw new NotFoundException('成员身份无效');
 }
 private public(row:any){return {id:row.id,kind:row.kind,mime:row.mime,locale:row.locale,state:row.state,consentVersion:row.consent_version,createdAt:row.created_at,expiresAt:row.expires_at,validation:'CONTAINER_ONLY',providerSubmitted:false};}
 private async purge(tx:TxClient,org:string,user:string){const expired=await tx.$queryRaw<{id:string;state:string}[]>`DELETE FROM persona_source_draft WHERE organization_id=${org} AND actor_id=${user} AND expires_at<=now() RETURNING id,state`;for(const row of expired)await this.audit.record(tx,{organizationId:org,actorId:user,title:'数字分身过期清理',action:'persona:expired-draft-purge',resourceType:'PersonaDraft',resourceId:row.id,traceId:'persona-purge:'+randomUUID(),before:{state:row.state},after:{sourceDeleted:true}});}
 async list(org:string,user:string){return this.prisma.withOrgUser(org,user,async tx=>{await this.member(tx,org,user);await this.purge(tx,org,user);const rows=await tx.$queryRaw<any[]>`SELECT id,kind,mime,locale,state,consent_version,created_at,expires_at FROM persona_source_draft WHERE organization_id=${org} AND actor_id=${user} ORDER BY created_at DESC LIMIT 20`;return rows.map(r=>this.public(r));});}
 async save(org:string,user:string,body:any,bytes:Buffer|undefined,trace:string){
  const input=sourceDraft(body,bytes);return this.prisma.withOrgUser(org,user,async tx=>{
   await this.member(tx,org,user);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${org+':'+user+':persona'},0))`;await this.purge(tx,org,user);
   const existing=await tx.$queryRaw<any[]>`SELECT * FROM persona_source_draft WHERE id=${input.id}::uuid AND organization_id=${org} AND actor_id=${user}`;
   if(existing[0]){if(existing[0].source_hash!==input.hash||existing[0].state==='REVOKED')throw new ConflictException('该编号已绑定其他素材或已撤销，请重新选择');return this.public(existing[0]);}
   const active=await tx.$queryRaw<{n:bigint}[]>`SELECT count(*) AS n FROM persona_source_draft WHERE organization_id=${org} AND actor_id=${user} AND state='DRAFT'`;
   if(Number(active[0].n)>=3)throw new HttpException('最多保留3个有效素材草稿，请先撤销旧草稿',429);
   const rows=await tx.$queryRaw<any[]>`INSERT INTO persona_source_draft(id,organization_id,actor_id,kind,mime,source,source_hash,consent_version,locale) VALUES(${input.id}::uuid,${org},${user},${input.kind},${input.mime},${bytes!},${input.hash},${CONSENT_VERSION},${input.locale}) RETURNING id,kind,mime,locale,state,consent_version,created_at,expires_at`;
   await this.audit.record(tx,{organizationId:org,actorId:user,title:'数字分身素材',action:'persona:draft',resourceType:'PersonaDraft',resourceId:input.id,traceId:trace,after:{kind:input.kind,state:'DRAFT',consentVersion:CONSENT_VERSION}});return this.public(rows[0]);
  });
 }
 async load(org:string,user:string,id:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new NotFoundException('素材不存在');
  return this.prisma.withOrgUser(org,user,async tx=>{await this.member(tx,org,user);const rows=await tx.$queryRaw<any[]>`SELECT * FROM persona_source_draft WHERE id=${id}::uuid AND organization_id=${org} AND actor_id=${user} AND expires_at>now() AND state='DRAFT'`;if(!rows[0])throw new NotFoundException('素材不存在或已撤销');return rows[0];});
 }
 async revoke(org:string,user:string,id:string,trace:string){
  await this.load(org,user,id);return this.prisma.withOrgUser(org,user,async tx=>{await this.member(tx,org,user);await tx.$executeRaw`UPDATE persona_source_draft SET source=NULL,state='REVOKED' WHERE id=${id}::uuid AND organization_id=${org} AND actor_id=${user}`;await this.audit.record(tx,{organizationId:org,actorId:user,title:'数字分身素材',action:'persona:revoke',resourceType:'PersonaDraft',resourceId:id,traceId:trace,after:{state:'REVOKED',sourceDeleted:true}});return {id,state:'REVOKED'};});
 }
 async create(org:string,user:string,id:string){await this.load(org,user,id);throw new ServiceUnavailableException('真人创建供应商尚未接入。草稿仍为私有保存，未训练、未生成、未收费');}
}
