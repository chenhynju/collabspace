import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

export const VOICES = { 'zh-CN': 'zh-CN-XiaoxiaoNeural', 'en-US': 'en-US-JennyNeural' } as const;
export type Locale = keyof typeof VOICES;
export function locale(value: unknown): Locale {
  if (value !== 'zh-CN' && value !== 'en-US') throw new BadRequestException('请选择中文或英文');
  return value;
}
/** Parse the actual container, never trust MIME, extension or client duration. */
export function wavInfo(b: Buffer) {
  const bad = () => { throw new BadRequestException('需要16kHz单声道16位PCM WAV，时长不超过60秒'); };
  if (!b || b.length < 44 || b.length > 10 * 1024 * 1024 || b.toString('ascii',0,4)!=='RIFF' || b.toString('ascii',8,12)!=='WAVE' || b.readUInt32LE(4)+8!==b.length) return bad();
  let format=false, bytes=0, chunks=0;
  for(let p=12;p+8<=b.length;) {
    const tag=b.toString('ascii',p,p+4), n=b.readUInt32LE(p+4);p+=8;
    if(p+n>b.length || ++chunks>128) return bad();
    if(tag==='fmt ') {
      if(format || n<16 || b.readUInt16LE(p)!==1 || b.readUInt16LE(p+2)!==1 || b.readUInt32LE(p+4)!==16000 || b.readUInt32LE(p+8)!==32000 || b.readUInt16LE(p+12)!==2 || b.readUInt16LE(p+14)!==16)return bad();
      format=true;
    }
    if(tag==='data'){if(bytes || n%2)return bad();bytes=n;}
    p+=n+(n%2);
  }
  const seconds=bytes/32000;
  if(!format || seconds<0.1 || seconds>60)return bad();
  return {seconds,bytes};
}
export function digest(...parts: (string|Buffer)[]) {
  const h=createHash('sha256');for(const p of parts){const b=Buffer.isBuffer(p)?p:Buffer.from(p);h.update(String(b.length)+':');h.update(b);}return h.digest('hex');
}
export function xml(text:string){return text.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));}

export type PersonaState='idle'|'listening'|'thinking'|'executing'|'awaiting-confirmation'|'speaking'|'completed'|'failed'|'cancelled';
export function personaEvent(value:any) {
  const states:PersonaState[]=['idle','listening','thinking','executing','awaiting-confirmation','speaking','completed','failed','cancelled'];
  if(value?.version!==1 || !states.includes(value.state) || typeof value.runId!=='string' || value.runId.length>100 || !['agent','skill'].includes(value.source)) throw new BadRequestException('无效的形象事件');
  if(value.state==='completed' && (value.authority!=='runtime' || typeof value.resultRef!=='string' || !value.resultRef.trim()))throw new BadRequestException('完成状态必须关联运行时结果');
  return {version:1,runId:value.runId,source:value.source,state:value.state,resultRef:value.resultRef||null};
}
