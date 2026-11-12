import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export type Meeting = {id:string;organization_id:string;project_id:string;host_id:string;title:string;status:'ACTIVE'|'ENDING'|'ENDED';media_issued:boolean;issued_user_ids:string[];revoked_user_ids:string[];created_at:Date;ended_at:Date|null};
export function meetingId(value:unknown):string {
  if(typeof value!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new BadRequestException('需要UUID会议编号');
  return value.toLowerCase();
}
export function meetingInput(body:any) {
  const id=meetingId(body?.requestId);
  if(typeof body?.projectId!=='string'||!body.projectId||body.projectId.length>100)throw new BadRequestException('请选择项目');
  if(typeof body?.title!=='string'||!body.title.trim()||body.title.trim().length>120)throw new BadRequestException('会议名称限1–120字');
  return {id,projectId:body.projectId,title:body.title.trim()};
}
export function mediaRoom(org:string,id:string){return 'rtc_'+createHash('sha256').update(JSON.stringify([org,id])).digest('hex');}
export function mediaIdentity(org:string,user:string){return createHash('sha256').update(JSON.stringify([org,user])).digest('hex');}
