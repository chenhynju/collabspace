import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {isAbsolute,join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {existsSync,statSync} from 'node:fs';
import {ServiceUnavailableException} from '@nestjs/common';
import {wavInfo} from './voice-domain';

export type PhoneticFrame={offsetMs:number;endMs:number;id:number;source:'rhubarb-phonetic-v1'};
const execute=promisify(execFile);
export function mouthAnalysisStatus(){
 const enabled=process.env.SPEECH_LIP_SYNC_PROVIDER==='rhubarb',binary=process.env.RHUBARB_BIN||'';
 let configured=false;try{configured=enabled&&isAbsolute(binary)&&existsSync(binary)&&statSync(binary).isFile();}catch{}
 return {enabled,configured,kind:'basic-phonetic',precise:false,maxSeconds:60};
}
/** Application vowel IDs, not a claim of Azure-generated phoneme precision. */
export function phoneticFrames(value:any,seconds:number):PhoneticFrame[]{
 if(!value||!Array.isArray(value.mouthCues)||!value.mouthCues.length||value.mouthCues.length>10000||!Number.isFinite(value.metadata?.duration)||Math.abs(value.metadata.duration-seconds)>.05)throw Error('无效基础口型轨道');
 const map:Record<string,number>={A:21,B:6,C:4,D:1,E:3,F:7,G:6,H:14,X:0};let end=0;
 const track=value.mouthCues.map((cue:any)=>{
  if(!cue||typeof cue.value!=='string'||!Object.prototype.hasOwnProperty.call(map,cue.value)||!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.start<0||cue.end<=cue.start||cue.end>seconds+.02||Math.abs(cue.start-end)>.02)throw Error('基础口型时间范围无效');
  end=cue.end;return {offsetMs:Math.round(cue.start*1000),endMs:Math.round(cue.end*1000),id:map[cue.value],source:'rhubarb-phonetic-v1' as const};
 });
 if(Math.abs(end-seconds)>.05)throw Error('基础口型轨道不完整');return track;
}
/** Offline only. No shell, URLs, transcript upload or extra speech synthesis. */
export async function analyzeMouth(audio:Buffer,signal:AbortSignal):Promise<PhoneticFrame[]>{
 if(!mouthAnalysisStatus().configured)throw new ServiceUnavailableException('本地基础口型分析未配置');
 const {seconds}=wavInfo(audio);if(signal.aborted)throw Error('已取消口型分析');
 const dir=await mkdtemp(join(tmpdir(),'collabspace-mouth-')),file=join(dir,'input.wav');
 try{
  await writeFile(file,audio,{mode:0o600});
  const {stdout}=await execute(process.env.RHUBARB_BIN!,['-r','phonetic','-f','json',file],{signal,timeout:60000,maxBuffer:2*1024*1024,windowsHide:true,encoding:'utf8'});
  return phoneticFrames(JSON.parse(stdout),seconds);
 }catch{throw new ServiceUnavailableException(signal.aborted?'基础口型分析已取消':'基础口型分析未完成；原音频保留，未重新合成');}
 finally{await unlink(file).catch(()=>{});await rmdir(dir).catch(()=>{});}
}
