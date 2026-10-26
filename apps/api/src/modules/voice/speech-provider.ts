import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Locale, VOICES, xml } from './voice-domain';
import {synthesizeWithVisemes,type SpeechViseme} from './azure-viseme';
import { UnconfiguredAvatarProvider } from './avatar-provider';

@Injectable()
export class SpeechProvider {
  private avatar=new UnconfiguredAvatarProvider();
  get cloud(){return process.env.AZURE_SPEECH_CLOUD||'global';}
  get ready(){const region=process.env.AZURE_SPEECH_REGION||'';return !!process.env.AZURE_SPEECH_KEY && /^[a-z0-9-]+$/.test(region)&&['global','china'].includes(this.cloud)&&(this.cloud==='china'?['chinaeast2','chinanorth2','chinanorth3'].includes(region):!region.startsWith('china'));}
  get visemesEnabled(){return process.env.AZURE_VISEME_ENABLED==='true';}
  status(){return {provider:'azure',cloud:this.cloud,configured:this.ready,locales:Object.keys(VOICES),voices:VOICES,preciseVisemes:this.ready&&this.visemesEnabled,realistic:{configured:this.avatar.configured,reason:'尚未选定并配置真人服务'},maxSeconds:60,maxText:4000};}
  async run(kind:'STT'|'TTS',input:Buffer|string,language:Locale,signal:AbortSignal):Promise<{text?:string;audio?:Buffer;visemes?:SpeechViseme[]}> {
    if(!this.ready)throw new ServiceUnavailableException('Azure语音未配置，未调用供应商');
    const region=process.env.AZURE_SPEECH_REGION!;
    const key=process.env.AZURE_SPEECH_KEY!;
    if(kind==='TTS'&&this.visemesEnabled)return synthesizeWithVisemes(input as string,language,region,this.cloud,key,signal);
    const domain=this.cloud==='china'?'azure.cn':'microsoft.com';
    const url=kind==='STT'
      ?`https://${region}.stt.speech.${domain}/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=simple`
      :`https://${region}.tts.speech.${domain}/cognitiveservices/v1`;
    const body=kind==='STT'?new Uint8Array(input as Buffer).buffer:`<speak version="1.0" xml:lang="${language}"><voice name="${VOICES[language]}">${xml(input as string)}</voice></speak>`;
    const response=await fetch(url,{method:'POST',signal,headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':kind==='STT'?'audio/wav; codecs=audio/pcm; samplerate=16000':'application/ssml+xml',...(kind==='TTS'?{'X-Microsoft-OutputFormat':'riff-16khz-16bit-mono-pcm'}:{Accept:'application/json'})},body});
    if(!response.ok)throw new Error('供应商未确认结果，请核查后再操作');
    // Bound decompressed response bytes as well as declared length.
    const reader=response.body?.getReader();if(!reader)throw new Error('语音服务返回空响应');
    const chunks:Buffer[]=[];let length=0;
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>16*1024*1024){await reader.cancel();throw new Error('语音响应超过上限');}chunks.push(Buffer.from(value));}
    const data=Buffer.concat(chunks);
    if(kind==='TTS'){if(data.toString('ascii',0,4)!=='RIFF')throw new Error('无效语音响应');return {audio:data};}
    const result=JSON.parse(data.toString('utf8'));
    if(result.RecognitionStatus!=='Success'||typeof result.DisplayText!=='string'||!result.DisplayText.trim())throw new Error('没有识别到文字，请检查录音；不会自动重试');
    return {text:result.DisplayText.slice(0,4000)};
  }
}
