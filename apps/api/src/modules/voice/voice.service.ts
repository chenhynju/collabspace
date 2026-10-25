import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException, ConflictException, HttpException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService, TxClient } from '../../prisma/prisma.service';
import { ResourcePolicyService } from '../groups/resource-policy.service';
import { AuditService } from '../audit/audit.service';
import { SpeechProvider } from './speech-provider';
import { digest, locale, wavInfo } from './voice-domain';

type Scope={projectId?:string;conversationId?:string};
type Job={id:string;organization_id:string;actor_id:string;project_id:string|null;conversation_id:string|null;kind:'STT'|'TTS';locale:'zh-CN'|'en-US';input_hash:string;input_text:string|null;input_audio:Buffer|null;result_text:string|null;result_audio:Buffer|null;status:string;error:string|null;expires_at:Date;updated_at:Date;trace_id:string};
@Injectable()
export class VoiceService implements OnModuleInit,OnModuleDestroy {
  private running=new Map<string,AbortController>();
  private queue?:Queue;
  private worker?:Worker;
  constructor(private prisma:PrismaService,private policy:ResourcePolicyService,private audit:AuditService,private provider:SpeechProvider){}
  onModuleInit(){
    if(process.env.VOICE_QUEUE_ENABLED!=='true')return;
    const url=new URL(process.env.REDIS_URL||'redis://127.0.0.1:6379');
    const connection={host:url.hostname,port:Number(url.port||6379),username:url.username||undefined,password:url.password||undefined,db:Number(url.pathname.slice(1)||0),...(url.protocol==='rediss:'?{tls:{}}:{}),maxRetriesPerRequest:null};
    this.queue=new Queue('collabspace-voice-v1',{connection});
    this.worker=new Worker('collabspace-voice-v1',async job=>{const {org,user,id}=job.data;await this.process(org,user,id);},{connection,concurrency:2});
    this.queue.on('error',()=>{});this.worker.on('error',()=>{});
  }
  async onModuleDestroy(){for(const c of this.running.values())c.abort();await this.worker?.close();await this.queue?.close();}
  private async dispatch(org:string,user:string,id:string){
    if(this.queue){await this.queue.add('speech',{org,user,id},{jobId:id,attempts:1,removeOnComplete:100,removeOnFail:100});return;}
    await this.process(org,user,id);
  }
  async authorize(tx:TxClient,org:string,user:string,scope:Scope){
    const member=await tx.membership.findFirst({where:{organizationId:org,userId:user,status:'ACTIVE',user:{status:'NORMAL'},organization:{status:'ACTIVE'}}});
    if(!member)throw new NotFoundException('成员身份无效');
    if(!!scope.projectId===!!scope.conversationId)throw new BadRequestException('请选择一个项目或会话');
    if(scope.projectId){await this.policy.assert(tx,org,user,scope.projectId,'READ');return;}
    const c=await tx.conversationMember.findFirst({where:{organizationId:org,conversationId:scope.conversationId,userId:user,status:'ACTIVE'}});
    if(!c)throw new NotFoundException('会话不存在或无权限');
  }
  async create(org:string,user:string,b:any,audio:Buffer|undefined,trace:string){
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b?.requestId||''))throw new BadRequestException('需要UUID发送编号');
    const language=locale(b?.locale),kind=b?.kind;
    if(kind!=='STT'&&kind!=='TTS')throw new BadRequestException('无效语音操作');
    if(kind==='STT')wavInfo(audio!);
    else if(typeof b.text!=='string'||!b.text.trim()||b.text.length>4000)throw new BadRequestException('朗读文字限1–4000字');
    const scope={projectId:b.projectId||undefined,conversationId:b.conversationId||undefined};
    if(Object.values(scope).some(v=>v!==undefined&&(typeof v!=='string'||v.length>100)))throw new BadRequestException('无效项目或会话');
    const hash=digest(kind,language,JSON.stringify(scope),kind==='STT'?audio!:b.text);
    const result=await this.prisma.withOrgUser(org,user,async tx=>{
      await this.authorize(tx,org,user,scope);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${org+':'+user+':voice'},0))`;
      // Access cleanup is deterministic; raw inputs/results expire even without a queue worker.
      await tx.$executeRaw`DELETE FROM voice_job WHERE organization_id=${org} AND actor_id=${user} AND expires_at<=now()`;
      const old=await tx.$queryRaw<Job[]>`SELECT * FROM voice_job WHERE id=${b.requestId}::uuid AND organization_id=${org} AND actor_id=${user}`;
      if(old.length){if(old[0].input_hash!==hash)throw new ConflictException('同一编号不能更改内容');return this.public(old[0]);}
      if(!this.provider.ready)throw new ServiceUnavailableException('Azure语音未配置，未调用供应商');
      const budget=await tx.$queryRaw<{n:bigint;active:bigint}[]>`SELECT count(*) AS n,count(*) FILTER(WHERE status IN ('QUEUED','RUNNING')) AS active FROM voice_job WHERE organization_id=${org} AND actor_id=${user} AND created_at>now()-interval '1 hour'`;
      if(Number(budget[0].n)>=20||Number(budget[0].active)>=1)throw new HttpException('语音每小时20次，同时只允许1个任务',429);
      await tx.$executeRaw`INSERT INTO voice_job(id,organization_id,actor_id,project_id,conversation_id,kind,locale,input_hash,input_text,input_audio,trace_id) VALUES(${b.requestId}::uuid,${org},${user},${scope.projectId||null},${scope.conversationId||null},${kind},${language},${hash},${kind==='TTS'?b.text:null},${kind==='STT'?audio:null},${trace})`;
      await this.audit.record(tx,{organizationId:org,actorId:user,title:'语音',action:'voice:create',resourceType:'VoiceJob',resourceId:b.requestId,traceId:trace,after:{kind,locale:language,status:'QUEUED'}});
      return {id:b.requestId,status:'QUEUED',kind,locale:language,text:null,error:null};
    });
    // Durable DB claim prevents duplicate paid calls. Poll/reload resumes QUEUED work.
    if(result.status==='QUEUED')void this.dispatch(org,user,b.requestId).catch(()=>{});
    return result;
  }
  private public(j:Job){return {id:j.id,status:j.status,kind:j.kind,locale:j.locale,text:j.result_text,error:j.error,hasAudio:!!j.result_audio||!!(j as any).has_audio,expiresAt:j.expires_at};}
  async history(org:string,user:string,scope:Scope){return this.prisma.withOrgUser(org,user,async tx=>{
    await this.authorize(tx,org,user,scope);
    const rows=await tx.$queryRaw<Job[]>`SELECT id,kind,locale,status,result_text,error,expires_at,updated_at,(result_audio IS NOT NULL) AS has_audio FROM voice_job WHERE organization_id=${org} AND actor_id=${user} AND project_id IS NOT DISTINCT FROM ${scope.projectId||null} AND conversation_id IS NOT DISTINCT FROM ${scope.conversationId||null} AND expires_at>now() ORDER BY created_at DESC LIMIT 10`;
    return rows.map(j=>this.public(j));
  });}
  async get(org:string,user:string,id:string){
    const j=await this.load(org,user,id);
    if(j.status==='RUNNING'&&Date.now()-j.updated_at.getTime()>120000){await this.finish(org,user,id,'UNKNOWN',null,null,'执行中断，结果待核查；不会自动重新收费');return this.public(await this.load(org,user,id));}
    if(j.status==='QUEUED')void this.dispatch(org,user,id).catch(()=>{});
    return this.public(j);
  }
  async load(org:string,user:string,id:string):Promise<Job>{
    if(!/^[a-f0-9-]{36}$/i.test(id))throw new NotFoundException('语音任务不存在');
    return this.prisma.withOrgUser(org,user,async tx=>{
      const rows=await tx.$queryRaw<Job[]>`SELECT * FROM voice_job WHERE id=${id}::uuid AND organization_id=${org} AND actor_id=${user} AND expires_at>now()`;
      const j=rows[0];if(!j)throw new NotFoundException('语音任务不存在或已过期');
      await this.authorize(tx,org,user,{projectId:j.project_id||undefined,conversationId:j.conversation_id||undefined});return j;
    });
  }
  async cancel(org:string,user:string,id:string){const j=await this.load(org,user,id);this.running.get(id)?.abort();await this.prisma.withOrgUser(org,user,async tx=>{await tx.$executeRaw`UPDATE voice_job SET status='CANCELLED',input_audio=NULL,input_text=NULL,result_audio=NULL,result_text=NULL,updated_at=now() WHERE id=${id}::uuid AND organization_id=${org} AND actor_id=${user}`;await this.audit.record(tx,{organizationId:org,actorId:user,title:'语音',action:'voice:cancel',resourceType:'VoiceJob',resourceId:id,traceId:j.trace_id,before:{status:j.status},after:{status:'CANCELLED'}});});return {id,status:'CANCELLED'};}
  private async finish(org:string,user:string,id:string,status:string,text:string|null,audio:Buffer|null,error:string|null){
    return this.prisma.withOrgUser(org,user,async tx=>{
      const changed=await tx.$queryRaw<{trace_id:string}[]>`UPDATE voice_job SET status=${status},result_text=${text},result_audio=${audio},input_audio=NULL,input_text=NULL,error=${error},updated_at=now() WHERE id=${id}::uuid AND organization_id=${org} AND actor_id=${user} AND status='RUNNING' AND expires_at>now() RETURNING trace_id`;
      if(changed[0])await this.audit.record(tx,{organizationId:org,actorId:user,title:'语音',action:'voice:finish',resourceType:'VoiceJob',resourceId:id,traceId:changed[0].trace_id,before:{status:'RUNNING'},after:{status}});
    });
  }
  async process(org:string,user:string,id:string){
    if(this.running.has(id))return;
    const c=new AbortController();this.running.set(id,c);const timer=setTimeout(()=>c.abort(),90000);
    try {
      const j=await this.load(org,user,id);
      const claimed=await this.prisma.withOrgUser(org,user,tx=>tx.$executeRaw`UPDATE voice_job SET status='RUNNING',updated_at=now() WHERE id=${id}::uuid AND organization_id=${org} AND actor_id=${user} AND status='QUEUED'`);
      if(!claimed)return;
      try{
        const result=await this.provider.run(j.kind,j.kind==='STT'?j.input_audio!:j.input_text!,j.locale,c.signal);
        await this.load(org,user,id); // revoke access before materializing results
        await this.finish(org,user,id,'SUCCEEDED',result.text||null,result.audio||null,null);
      }catch{await this.finish(org,user,id,'UNKNOWN',null,null,'语音未完成或结果待核查，不会自动重试；可保留录音并核查后新建请求');}
    }finally{clearTimeout(timer);this.running.delete(id);}
  }
}
