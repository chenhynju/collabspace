import {Controller,Get,Post,Put,Delete,Param,Body,Req,Res,UseGuards,UseInterceptors,UploadedFile} from '@nestjs/common';
import {PermissionsGuard} from '../../common/guards/permissions.guard';
import {RequirePermissions} from '../../common/decorators/permissions.decorator';
import {FileInterceptor} from '@nestjs/platform-express';
import {OrgContextGuard} from '../../common/guards/org-context.guard';
import {CurrentOrg,OrgContext} from '../../common/decorators/current-org.decorator';
import {CurrentUser} from '../../common/decorators/current-user.decorator';
import {PersonaService} from './persona.service';
import type {Request,Response} from 'express';
@Controller('voice/persona')
@UseGuards(OrgContextGuard)
export class PersonaController {
 constructor(private personas:PersonaService){}
 @Get('capabilities') capabilities(){return this.personas.capabilities();}
 @Get('agent') agent(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string}){return this.personas.agent(o.organizationId,u.id);}
 @Put('agent')
 @UseGuards(PermissionsGuard)
 @RequirePermissions('config:edit')
 configureAgent(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Body() b:any,@Req() req:Request){return this.personas.configureAgent(o.organizationId,u.id,b,req.traceId);}
 @Get('drafts') list(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string}){return this.personas.list(o.organizationId,u.id);}
 @Post('drafts')
 @UseInterceptors(FileInterceptor('file',{limits:{files:1,fileSize:20971520,fields:6,fieldSize:512}}))
 save(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Body() b:any,@UploadedFile() f:Express.Multer.File|undefined,@Req() req:Request){return this.personas.save(o.organizationId,u.id,b,f?.buffer,req.traceId);}
 @Get('drafts/:id/source') async source(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Res() res:Response){const row=await this.personas.load(o.organizationId,u.id,id);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition','attachment');res.type(row.mime).send(row.source);}
 @Delete('drafts/:id') revoke(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Req() req:Request){return this.personas.revoke(o.organizationId,u.id,id,req.traceId);}
 @Post('drafts/:id/create') create(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string){return this.personas.create(o.organizationId,u.id,id);}
}
