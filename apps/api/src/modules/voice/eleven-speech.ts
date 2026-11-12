import {ServiceUnavailableException} from '@nestjs/common';
import type {Locale} from './voice-domain';
import {readSpeechResponse,pcmToSpeechWav} from './speech-http';
export const elevenVoices=()=>({'zh-CN':process.env.ELEVENLABS_VOICE_ID_ZH||'','en-US':process.env.ELEVENLABS_VOICE_ID_EN||''});
export const elevenModels=()=>({stt:process.env.ELEVENLABS_STT_MODEL||'scribe_v2',tts:process.env.ELEVENLABS_TTS_MODEL||'eleven_multilingual_v2'});
export const elevenReady=()=>!!process.env.ELEVENLABS_API_KEY&&Object.values({...elevenVoices(),...elevenModels()}).every(v=>/^[a-zA-Z0-9_.-]{1,100}$/.test(v));
/** Overseas vendor, explicit opt-in. No fallback and no retries after submission. */
export async function runEleven(kind:'STT'|'TTS',input:Buffer|string,language:Locale,signal:AbortSignal):Promise<{text?:string;audio?:Buffer}>{
 if(!elevenReady())throw new ServiceUnavailableException('ElevenLabs尚未配置，未调用供应商');
 const headers:Record<string,string>={'xi-api-key':process.env.ELEVENLABS_API_KEY!};let body:FormData|string;
 if(kind==='STT'){const form=new FormData();form.append('file',new Blob([new Uint8Array(input as Buffer)],{type:'audio/wav'}),'recording.wav');form.append('model_id',elevenModels().stt);form.append('language_code',language==='zh-CN'?'zh':'en');form.append('diarize','false');form.append('tag_audio_events','false');body=form;}
 else{headers['Content-Type']='application/json';body=JSON.stringify({text:input,model_id:elevenModels().tts,language_code:language==='zh-CN'?'zh':'en'});}
 const url=kind==='STT'?'https://api.elevenlabs.io/v1/speech-to-text':'https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(elevenVoices()[language])+'?output_format=pcm_16000';
 const response=await fetch(url,{method:'POST',headers,body,signal});
 if(!response.ok){await response.body?.cancel();throw Error('ElevenLabs未确认结果；请核对权限和额度，不会自动重试');}
 const data=await readSpeechResponse(response,kind==='STT'?1024*1024:16*1024*1024);
 if(kind==='STT'){const text=JSON.parse(data.toString('utf8'))?.text;if(typeof text!=='string'||!text.trim()||text.length>4000)throw Error('未得到有效识别文字');return {text};}
 const type=response.headers.get('content-type')||'';if(!type.startsWith('audio/')&&!type.startsWith('application/octet-stream'))throw Error('无效语音响应类型');
 return {audio:pcmToSpeechWav(data)};
}
