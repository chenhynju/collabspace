import { Injectable, HttpException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ResourcePolicyService } from '../groups/resource-policy.service';
import { AuditService } from '../audit/audit.service';
import { AssistantService } from './assistant.service';

type State='thinking'|'executing'|'completed'|'failed'|'cancelled';
type Run={id:string;org:string;actor:string;project:string;mode:string;hash:string;expires:number;sequence:number;state:State;controller:AbortController;facts:{name:string;taskCount:number};result?:any;error?:string};
const terminal=(r:Run)=>['completed','failed','cancelled'].includes(r.state);
/** Bounded, read-only workflow. Process-local receipts are not a durable agent engine. */
@Injectable()
export class AssistantRuntimeService {
 private runs=new Map<string,Run>();
 constructor(private prisma:PrismaService,private policy:ResourcePolicyService,private ai:AssistantService,private audit:AuditService){}
 private async authorize(org:string,actor:string,project:string){return this.prisma.withOrg(org,async tx=>{
  const member=await tx.membership.findFirst({where:{organizationId:org,userId:actor,status:'ACTIVE',user:{status:'NORMAL'},organization:{status:'ACTIVE'}}});
  if(!member)throw new NotFoundException('成员身份无效');
  await this.policy.assert(tx,org,actor,project,'READ');
 });}
 private public(r:Run){return {id:r.id,projectId:r.project,skill:r.mode,state:r.state,expiresAt:new Date(r.expires).toISOString(),durable:false,
  event:{version:1,runId:r.id,sequence:r.sequence,source:'agent',authority:'runtime',state:r.state,...(r.state==='completed'?{resultRef:`assistant-run:${r.id}`}:{})},
  ...(r.state==='completed'?{result:r.result,projectFacts:r.facts}:{}),...(r.error?{error:r.error}:{})};}
 async start(org:string,actor:string,b:any,trace:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b?.requestId||''))throw new HttpException('需要UUID运行编号',400);
  const translation=['translate-en','translate-zh'].includes(b?.mode);
  if(!['summary','actions','email','translate-en','translate-zh'].includes(b?.mode)||typeof b?.text!=='string'||b.text.trim().length<(translation?1:50)||b.text.length>(translation?1200:100000)||typeof b?.projectId!=='string'||!b.projectId||b.projectId.length>100)throw new HttpException('无效的项目、能力或输入正文',400);
  await this.authorize(org,actor,b.projectId);
  const now=Date.now();for(const [id,run]of this.runs)if(run.expires<=now){run.controller.abort();this.runs.delete(id);}
  const hash=createHash('sha256').update(JSON.stringify([org,actor,b.projectId,b.mode,b.text])).digest('hex'),old=this.runs.get(b.requestId);
  if(old){if(old.org!==org||old.actor!==actor)throw new NotFoundException('运行不存在');if(old.hash!==hash)throw new HttpException('同一运行编号不能更改输入',409);return this.public(old);}
  if(this.runs.size>=500||[...this.runs.values()].some(r=>r.org===org&&r.actor===actor&&!terminal(r)))throw new HttpException('当前已有任务或运行容量已满',429);
  const run:Run={id:b.requestId,org,actor,project:b.projectId,mode:b.mode,hash,expires:now+15*60000,sequence:0,state:'thinking',controller:new AbortController(),facts:{name:'',taskCount:0}};
  this.runs.set(run.id,run);void this.execute(run,b.text,trace);return this.public(run);
 }
 private async execute(r:Run,text:string,trace:string){
  try{
   // Actual read-only project tool; resource policy and RLS precede every data read.
   r.facts=await this.prisma.withOrg(r.org,async tx=>{
    await this.policy.assert(tx,r.org,r.actor,r.project,'READ');
    const project=await tx.project.findFirst({where:{id:r.project,organizationId:r.org},select:{name:true}});
    if(!project)throw new NotFoundException();
    return {name:project.name,taskCount:await tx.task.count({where:{organizationId:r.org,projectId:r.project}})};
   });
   if(terminal(r))return;r.state='executing';r.sequence++;
   const result=await this.ai.generate(`${r.org}:${r.actor}:${r.project}`,text,r.mode,`${r.org}:${r.actor}`,r.controller.signal);
   await this.authorize(r.org,r.actor,r.project);
   if(terminal(r))return;
   if(typeof result.text!=='string'||!result.text.trim()||result.incomplete)throw new Error('Incomplete result');
   r.result=result;r.state='completed';r.sequence++;
  }catch{if(!terminal(r)){r.state='failed';r.sequence++;r.error='执行失败、权限变化或结果不完整；不会自动重试。';}}
  finally{
   try{await this.prisma.withOrg(r.org,tx=>this.audit.record(tx,{organizationId:r.org,actorId:r.actor,title:'协作助手运行',action:'assistant:run',resourceType:'AssistantRun',resourceId:r.id,traceId:trace,after:{skill:r.mode,state:r.state,cached:r.result?.cached||false,durable:false}}));}catch{/* Audit adapter reports its own errors; no source/result text is logged. */}
  }
 }
 async get(org:string,actor:string,id:string){const r=this.runs.get(id);if(!r||r.org!==org||r.actor!==actor||r.expires<=Date.now())throw new NotFoundException('运行不存在或已过期/服务已重启');await this.authorize(org,actor,r.project);return this.public(r);}
 async cancel(org:string,actor:string,id:string){await this.get(org,actor,id);const r=this.runs.get(id)!;if(!terminal(r)){r.controller.abort();r.state='cancelled';r.sequence++;r.result=undefined;}return this.public(r);}
}
