import { Body, Controller, Post, Get, UploadedFile, UseGuards, UseInterceptors, HttpException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrgContextGuard } from '../../common/guards/org-context.guard';
import { CurrentOrg, OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ResourcePolicyService } from '../groups/resource-policy.service';
import { AssistantService } from './assistant.service';
import { execFile } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { AuditService } from '../audit/audit.service';
import type { Request } from 'express';
import { Req } from '@nestjs/common';
import { Query } from '@nestjs/common';
import { ProjectMailService } from './project-mail.service';

@Controller('assistant')
@UseGuards(OrgContextGuard)
export class AssistantController {
  private parsing=0;
  constructor(private prisma: PrismaService, private policy: ResourcePolicyService, private ai: AssistantService, private audit: AuditService, private projectMail: ProjectMailService) {}
  private authorize(o: OrgContext, u: {id: string}, projectId: string) {
    if (!projectId || typeof projectId !== 'string') throw new HttpException('请选择项目', 400);
    return this.prisma.withOrg(o.organizationId, tx => this.policy.assert(tx, o.organizationId, u.id, projectId, 'READ'));
  }
  @Get('status') status() { return { ai: !!process.env.DEEPSEEK_API_KEY, mail:this.projectMail.ready, speech: 'browser',agentRuntime:true,runtimeDurable:false }; }
  @Post('mail') sendMail(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Body() b:any,@Req() req:Request){return this.projectMail.send(o,u,b,req.traceId);}
  @Get('mail') mailHistory(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Query('projectId') p:string){return this.projectMail.list(o,u,p);}
  @Post('generate') async generate(@CurrentOrg() o: OrgContext, @CurrentUser() u: {id: string}, @Body() b: any, @Req() req: Request) {
    await this.authorize(o, u, b?.projectId);
    const result = await this.ai.generate(`${o.organizationId}:${u.id}:${b.projectId}`, b?.text, b?.mode,`${o.organizationId}:${u.id}`);
    await this.authorize(o, u, b.projectId);
    await this.prisma.withOrg(o.organizationId, tx=>this.audit.record(tx,{organizationId:o.organizationId,actorId:u.id,title:'协作助手',action:'assistant:generate',resourceType:'Project',resourceId:b.projectId,traceId:req.traceId,after:{mode:b.mode,cached:result.cached,truncated:result.truncated,usage:result.usage}}));
    return result;
  }
  @Post('extract')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async extract(@CurrentOrg() o: OrgContext, @CurrentUser() u: {id: string}, @Body('projectId') p: string, @UploadedFile() f: Express.Multer.File) {
    await this.authorize(o, u, p);
    if (!f?.buffer) throw new HttpException('请选择文件', 400);
    if(f.buffer.length>5*1024*1024)throw new HttpException('文件最大5MB',413);
    if(this.parsing>=2)throw new HttpException('文档解析繁忙，请稍后重试',429);
    let kind: string;
    let extracted: {text:string;truncated:boolean};
    try {
      if (/\.docx$/i.test(f.originalname) && f.buffer.subarray(0,2).toString() === 'PK') {
        kind = 'docx';
      } else if (/\.pdf$/i.test(f.originalname) && f.buffer.subarray(0,5).toString() === '%PDF-') {
        kind = 'pdf';
      } else if (/\.(txt|md)$/i.test(f.originalname)) kind = 'text';
      else throw new Error();
      this.parsing++;
      try{extracted = await new Promise((resolve,reject)=>{
        const worker=join(__dirname,'extract-worker.js');
        const args=existsSync(worker)?[worker,kind]:['-r',require.resolve('ts-node/register/transpile-only'),join(__dirname,'extract-worker.ts'),kind];
        const child = execFile(process.execPath,['--max-old-space-size=128',...args],{timeout:10000,maxBuffer:700000,windowsHide:true},(error,stdout)=>{
          if(error)return reject(error);
          try{resolve(JSON.parse(stdout));}catch(e){reject(e);}
        });
        child.stdin?.on('error',()=>{});child.stdin?.end(f.buffer);
      });}finally{this.parsing--;}
    } catch { throw new HttpException('无法解析文件：支持 DOCX、文字型 PDF（前30页）、TXT、MD；旧版DOC及扫描件请先转换', 400); }
    if (extracted.text.trim().length < 50) throw new HttpException('未提取到足够文字，扫描件请先做OCR', 400);
    await this.authorize(o,u,p);
    return { ...extracted, persisted: false };
  }
}
