import {BadRequestException} from '@nestjs/common';
import {createHash} from 'crypto';
export const CONSENT_VERSION='employee-likeness-draft-v1';
export function sourceDraft(body:any,bytes:Buffer|undefined){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body?.requestId||''))throw new BadRequestException('需要UUID草稿编号');
 if(body?.consentVersion!==CONSENT_VERSION||body?.consent!=='true')throw new BadRequestException('请本人确认本次私有素材草稿授权；不包含声音克隆或外发授权');
 if(!['PHOTO','VIDEO'].includes(body?.kind)||!['zh-CN','en-US'].includes(body?.locale))throw new BadRequestException('无效素材类型或语言');
 if(!bytes||bytes.length<32||bytes.length>20*1024*1024)throw new BadRequestException('素材限20MB，文件为空或超过限制');
 let mime='';
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){
  const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(!w||!h||w>8192||h>8192)throw new BadRequestException('图片尺寸无效或超过8192像素');mime='image/png';
 }else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217)mime='image/jpeg';
 else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length)mime='image/webp';
 else if(bytes.toString('ascii',4,8)==='ftyp'&&bytes.readUInt32BE(0)>=16&&bytes.readUInt32BE(0)<=bytes.length)mime='video/mp4';
 else if(bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))&&bytes.subarray(0,4096).includes(Buffer.from('webm')))mime='video/webm';
 if(!mime||(body.kind==='PHOTO')!==mime.startsWith('image/'))throw new BadRequestException('不支持的实际文件类型，扩展名不能代替素材检查');
 // This is container validation, NOT face verification or provider approval.
 const hash=createHash('sha256').update(bytes).update(JSON.stringify([body.kind,body.locale,CONSENT_VERSION])).digest('hex');
 return {id:body.requestId as string,kind:body.kind as 'PHOTO'|'VIDEO',locale:body.locale as string,mime,hash};
}
