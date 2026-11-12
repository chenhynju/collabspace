import {randomUUID} from 'node:crypto';
import {ServiceUnavailableException} from '@nestjs/common';
import type {Locale} from './voice-domain';
export const volcVoices=()=>({'zh-CN':process.env.VOLC_TTS_VOICE_ZH||'','en-US':process.env.VOLC_TTS_VOICE_EN||''});
export const volcReady=()=>!!process.env.VOLC_SPEECH_API_KEY&&Object.values(volcVoices()).every(Boolean)&&!!process.env.VOLC_TTS_RESOURCE_ID;
import {readSpeechResponse,pcmToSpeechWav} from './speech-http';
/** Explicit China-region alternative. Never retries or switches providers after a request. */
export async function runVolc(kind:'STT'|'TTS',input:Buffer|string,language:Locale,signal:AbortSignal):Promise<{text?:string;audio?:Buffer}>{
 if(!volcReady())throw new ServiceUnavailableException('豆包语音尚未配置，未调用供应商');
 const headers={'Content-Type':'application/json','X-Api-Key':process.env.VOLC_SPEECH_API_KEY!,'X-Api-Request-Id':randomUUID(),'X-Api-Resource-Id':kind==='STT'?'volc.bigasr.auc_turbo':process.env.VOLC_TTS_RESOURCE_ID!};
 const response=await fetch('https://openspeech.bytedance.com/api/v3/'+(kind==='STT'?'auc/bigmodel/recognize/flash':'tts/unidirectional/sse'),{method:'POST',signal,headers:{...headers,...(kind==='STT'?{'X-Api-Sequence':'-1'}:{})},body:JSON.stringify(kind==='STT'?{user:{uid:'collabspace'},audio:{data:(input as Buffer).toString('base64')},request:{model_name:'bigmodel'}}:{user:{uid:'collabspace'},req_params:{text:input,speaker:volcVoices()[language],audio_params:{format:'pcm',sample_rate:16000}}})});
 if(!response.ok){await response.body?.cancel();throw Error('语音供应商未确认结果；不会自动重试');}
 const data=await readSpeechResponse(response,kind==='STT'?1024*1024:24*1024*1024);
 if(kind==='STT'){
  if(response.headers.get('X-Api-Status-Code')!=='20000000')throw Error('语音识别未成功确认');
  const text=JSON.parse(data.toString('utf8'))?.result?.text;if(typeof text!=='string'||!text.trim()||text.length>4000)throw Error('未得到有效识别文字');return {text};
 }
 const chunks:Buffer[]=[];let done=false,length=0;
 for(const line of data.toString('utf8').split(/\r?\n/)){
  if(!line.startsWith('data:'))continue;const event=JSON.parse(line.slice(5).trim());
  if(done)throw Error('语音完成后收到额外数据');
  if(event.code!==0&&event.code!==20000000)throw Error('语音合成未成功确认');
  if(event.data){if(typeof event.data!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(event.data))throw Error('无效语音编码');const b=Buffer.from(event.data,'base64');length+=b.length;if(length>16*1024*1024)throw Error('语音响应超过上限');chunks.push(b);}
  if(event.code===20000000)done=true;
 }
 if(!done)throw Error('语音流中断，结果未确认');return {audio:pcmToSpeechWav(Buffer.concat(chunks))};
}
