/** Normalize recorded browser formats locally. No microphone audio leaves the page until requested. */
export async function toWav(blob:Blob):Promise<Blob>{
 const context=new AudioContext();
 try{
  const decoded=await context.decodeAudioData(await blob.arrayBuffer());
  if(decoded.duration<0.1||decoded.duration>60.2)throw Error('录音时长需在0.1至60秒之间');
  const length=Math.min(60*16000,Math.round(decoded.duration*16000));
  const offline=new OfflineAudioContext(1,length,16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const samples=(await offline.startRendering()).getChannelData(0),buffer=new ArrayBuffer(44+length*2),view=new DataView(buffer);
  const str=(p:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(p+i,s.charCodeAt(i));};
  str(0,'RIFF');view.setUint32(4,36+length*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,length*2,true);
  for(let i=0;i<length;i++){const v=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,v<0?v*32768:v*32767,true);}
  return new Blob([buffer],{type:'audio/wav'});
 }finally{await context.close();}
}
