import {Body,Controller,Get,Post,Param,Query,Req,Res,UseGuards,HttpException,HttpCode,OnModuleInit,OnModuleDestroy} from '@nestjs/common';
import type {Request,Response} from 'express';
import {OrgContextGuard} from '../../common/guards/org-context.guard';
import {CurrentOrg,OrgContext} from '../../common/decorators/current-org.decorator';
import {CurrentUser} from '../../common/decorators/current-user.decorator';
import {Public} from '../../common/decorators/public.decorator';
import {OfficeService} from './office.service';
import {PermissionsGuard} from '../../common/guards/permissions.guard';
import {RequirePermissions} from '../../common/decorators/permissions.decorator';
import {IsIn,IsString,IsUUID,Length} from 'class-validator';

class CreateOfficeDto {
 @IsString() @Length(1,150) title:string;
 @IsIn(['docx','xlsx','pptx']) extension:string;
 @IsString() @Length(1,100) projectId:string;
 @IsUUID() requestId:string;
}
class RenameOfficeDto {
 @IsString() @Length(1,150) title:string;
 @IsString() @Length(1,160) expectedTitle:string;
}
class OfficeVersionDto { @IsUUID() versionId:string; }
class CopyOfficeDto extends OfficeVersionDto {
 @IsString() @Length(1,150) title:string;
 @IsUUID() requestId:string;
}

@Controller('office')
export class OfficeController {
 constructor(private readonly store:OfficeService){}
 private async call(method:string,...args:any[]){try{return await this.store[method](...args)}catch(e:any){if(e.status)throw new HttpException({code:e.code,message:e.code},e.status);throw e}}
 private ctx(o:OrgContext,u:{id:string}){return {org:o.organizationId,user:u.id}}
 @Post('create') @UseGuards(OrgContextGuard,PermissionsGuard) @RequirePermissions('file:manage')
 create(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Body() b:CreateOfficeDto){return this.call('createBlank',this.ctx(o,u),b.projectId,b)}
 @Post('files/:file/open') @UseGuards(OrgContextGuard)
 open(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('file') id:string){return this.call('importFile',this.ctx(o,u),id)}
 @Post(':id/config') @UseGuards(OrgContextGuard)
 config(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string){return this.call('config',this.ctx(o,u),id)}
 @Get(':id/state') @UseGuards(OrgContextGuard)
 state(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Query('sessionId') sessionId:string){return this.call('heartbeat',this.ctx(o,u),id,sessionId)}
 @Post(':id/save') @UseGuards(OrgContextGuard)
 save(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string){return this.call('force',this.ctx(o,u),id)}
 @Post(':id/name') @UseGuards(OrgContextGuard)
 rename(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Body() b:RenameOfficeDto){return this.call('renameOffice',this.ctx(o,u),id,b)}
 @Post(':id/copy') @UseGuards(OrgContextGuard,PermissionsGuard) @RequirePermissions('file:manage')
 copy(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Body() b:CopyOfficeDto){return this.call('copyOffice',this.ctx(o,u),id,b)}
 @Post(':id/export/pdf') @UseGuards(OrgContextGuard)
 async exportPdf(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Body() b:OfficeVersionDto,@Res() res:Response){
  const result=await this.call('exportPdf',this.ctx(o,u),id,b.versionId);
  res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Office-Revision',String(result.revision));res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(result.name));res.send(result.bytes);
 }
 @Post(':id/restart') @UseGuards(OrgContextGuard)
 restart(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Body() b:any){return this.call('restart',this.ctx(o,u),id,b.generation)}
 @Post(':id/restore') @UseGuards(OrgContextGuard)
 restore(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Body() b:any){return this.call('restoreOffice',this.ctx(o,u),id,b.versionId,b.requestId)}
 @Get(':id/download') @UseGuards(OrgContextGuard)
 async download(@CurrentOrg() o:OrgContext,@CurrentUser() u:{id:string},@Param('id') id:string,@Query('version') version:string,@Res() res:Response){this.send(res,await this.call('bytes',this.ctx(o,u),id,version))}
 @Public() @Get('engine/file')
 async file(@Query('cap') cap:string,@Res() res:Response){this.send(res,await this.call('engineFile',cap))}
 @Public() @Post('engine/callback') @HttpCode(200)
 async callback(@Query('cap') cap:string,@Body() b:any,@Req() req:Request){return this.call('callback',cap,req.headers.authorization?.replace(/^Bearer /,''),b)}
 private send(res:Response,file:any){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.'+({docx:'wordprocessingml.document',xlsx:'spreadsheetml.sheet',pptx:'presentationml.presentation'}[file.extension]));res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(file.name));res.send(file.bytes)}
}
