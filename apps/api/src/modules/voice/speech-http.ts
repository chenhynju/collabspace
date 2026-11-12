export async function readSpeechResponse(response:Response,max:number){
 const reader=response.body?.getReader();if(!reader)throw Error('语音服务返回空响应');const parts:Buffer[]=[];let bytes=0;
 try{while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.length;if(bytes>max)throw Error('语音响应超过上限');parts.push(Buffer.from(r.value));}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}return Buffer.concat(parts);
}
export function pcmToSpeechWav(pcm:Buffer){if(!pcm.length||pcm.length%2)throw Error('无效语音PCM');const b=Buffer.alloc(44);b.write('RIFF');b.writeUInt32LE(pcm.length+36,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm.length,40);return Buffer.concat([b,pcm]);}
