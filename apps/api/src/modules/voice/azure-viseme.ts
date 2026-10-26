import {xml,VOICES,type Locale} from './voice-domain';
export type SpeechViseme={offsetMs:number;id:number};
/** One synthesis produces both the audio and timed mouth track. No text re-synthesis. */
export async function synthesizeWithVisemes(text:string,language:Locale,region:string,cloud:string,key:string,signal:AbortSignal){
 const sdk=await import('microsoft-cognitiveservices-speech-sdk');
 if(signal.aborted)throw Error('已取消');
 const domain=cloud==='china'?'azure.cn':'microsoft.com';
 const config=sdk.SpeechConfig.fromEndpoint(new URL(`wss://${region}.tts.speech.${domain}/cognitiveservices/websocket/v1`),key);
 config.speechSynthesisOutputFormat=sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
 const synthesizer=new sdk.SpeechSynthesizer(config,undefined),track:SpeechViseme[]=[];
 return new Promise<{audio:Buffer;visemes:SpeechViseme[]}>((resolve,reject)=>{
  let done=false;
  const finish=(error?:Error,audio?:Buffer)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);try{synthesizer.close();}catch{/* Preserve the synthesis outcome when disposing. */}if(error)reject(error);else resolve({audio:audio!,visemes:track});};
  const abort=()=>finish(Error('已取消'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
  synthesizer.visemeReceived=(_sender,event)=>{const offsetMs=Math.round(event.audioOffset/10000);if(track.length<8192&&Number.isFinite(offsetMs)&&offsetMs>=0&&event.visemeId>=0&&event.visemeId<=21&&(!track.length||offsetMs>=track[track.length-1].offsetMs))track.push({offsetMs,id:event.visemeId});};
  try{synthesizer.speakSsmlAsync(`<speak version="1.0" xml:lang="${language}"><voice name="${VOICES[language]}">${xml(text)}</voice></speak>`,result=>{
   if(result.reason!==sdk.ResultReason.SynthesizingAudioCompleted){finish(Error('供应商未确认音轨结果'));return;}
   const audio=Buffer.from(result.audioData);if(audio.length>16777216||audio.toString('ascii',0,4)!=='RIFF'){finish(Error('音轨无效或超过上限'));return;}
   finish(undefined,audio);
  },()=>finish(Error('音轨合成失败，结果待核查')));}catch{finish(Error('音轨合成未确认，请核查结果'));}
 });
}
