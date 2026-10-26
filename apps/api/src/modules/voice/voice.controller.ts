import { Body, Controller, Get, Post, Put, Delete, Param, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrgContextGuard } from '../../common/guards/org-context.guard';
import { CurrentOrg, OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VoiceService } from './voice.service';
import { SpeechProvider } from './speech-provider';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { locale } from './voice-domain';
import type { Request, Response } from 'express';

@Controller('voice')
@UseGuards(OrgContextGuard)
export class VoiceController {
 constructor(private voice:VoiceService,private speech:SpeechProvider,private prisma:PrismaService,private audit:AuditService){}
 @Get('status') status(){return this.speech.status();}
 @Get('jobs') history(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Query('projectId') projectId?:string,@Query('conversationId') conversationId?:string){return this.voice.history(o.organizationId,u.id,{projectId,conversationId});}
 @Post('jobs')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1}}))
 create(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Body() b:any,@UploadedFile() f:Express.Multer.File|undefined,@Req() req:Request){return this.voice.create(o.organizationId,u.id,b,f?.buffer,req.traceId);}
 @Get('jobs/:id') get(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string){return this.voice.get(o.organizationId,u.id,id);}
 @Delete('jobs/:id') cancel(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string){return this.voice.cancel(o.organizationId,u.id,id);}
 @Get('jobs/:id/audio') async audio(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Res() res:Response){
   const j=await this.voice.load(o.organizationId,u.id,id);
   if(j.status!=='SUCCEEDED'||!j.result_audio)throw new BadRequestException('音频尚未生成');
   res.setHeader('Cache-Control','no-store');res.type('audio/wav').send(j.result_audio);
 }
 @Get('persona') persona(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string}){return this.prisma.withOrgUser(o.organizationId,u.id,async tx=>{
   const rows=await tx.$queryRaw<any[]>`SELECT style,locale FROM persona_profile WHERE organization_id=${o.organizationId} AND actor_id=${u.id}`;
   return {identity:'human',actorId:u.id,...(rows[0]||{style:'realistic',locale:'zh-CN'}),realisticAvailable:false};
 });}
 @Put('persona') save(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Body() b:any,@Req() req:Request){
   const language=locale(b?.locale);if(!['cartoon','realistic'].includes(b?.style))throw new BadRequestException('无效形象');
   return this.prisma.withOrgUser(o.organizationId,u.id,async tx=>{
     const before=await tx.$queryRaw<any[]>`SELECT style,locale FROM persona_profile WHERE organization_id=${o.organizationId} AND actor_id=${u.id}`;
     await tx.$executeRaw`INSERT INTO persona_profile(organization_id,actor_id,style,locale) VALUES(${o.organizationId},${u.id},${b.style},${language}) ON CONFLICT(organization_id,actor_id) DO UPDATE SET style=EXCLUDED.style,locale=EXCLUDED.locale,updated_at=now()`;
     await this.audit.record(tx,{organizationId:o.organizationId,actorId:u.id,title:'数字形象',action:'persona:update',resourceType:'Persona',resourceId:u.id,traceId:req.traceId,before:before[0]||null,after:{style:b.style,locale:language}});
     return {style:b.style,locale:language,identity:'human',realisticAvailable:false};
   });
 }
}
