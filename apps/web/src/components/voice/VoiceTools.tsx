'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';
import {Button,inputCls} from '@/components/ui';
import {Disclosure} from '@/components/disclosure';
import {publishCharacter} from '@/components/personas/character-playback';
import {toWav} from './audio';

type Scope={projectId?:string;conversationId?:string};
const errorText=(e:any)=>typeof e.response?.data?.message==='string'?e.response.data.message:e.message||'语音操作失败';
export function VoiceTools({scope,text,onTranscript,onSendAudio,active=true,onBusyChange,personaSubject}:{scope:Scope;personaSubject?:string;text:string;onTranscript?:(text:string)=>void;onSendAudio?:(file:File)=>Promise<void>;active?:boolean;onBusyChange?:(busy:boolean)=>void}){
 const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id);
 return <VoiceSession key={`${org}:${user}:${scope.projectId||scope.conversationId}`} scope={scope} text={text} onTranscript={onTranscript} onSendAudio={onSendAudio} active={active} onBusyChange={onBusyChange} personaSubject={personaSubject}/>;
}
function VoiceSession({scope,text,onTranscript,onSendAudio,active,onBusyChange,personaSubject}:{scope:Scope;personaSubject?:string;text:string;onTranscript?:(text:string)=>void;onSendAudio?:(file:File)=>Promise<void>;active:boolean;onBusyChange?:(busy:boolean)=>void}){
 const [recording,setRecording]=useState(false),[blob,setBlob]=useState<Blob|null>(null),[url,setUrl]=useState(''),[language,setLanguage]=useState('zh-CN');
 const [providerName,setProviderName]=useState('所选语音服务');
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[speaking,setSpeaking]=useState(false),[supported,setSupported]=useState(false);
 const [history,setHistory]=useState<any[]>([]);
 useEffect(()=>{onBusyChange?.(recording||busy);},[recording,busy,onBusyChange]);
 const localeTouched=useRef(false);
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>>(),epoch=useRef(0),alive=useRef(true),audio=useRef<HTMLAudioElement|null>(null),request=useRef<AbortController|null>(null),job=useRef<string|null>(null),pending=useRef<{id:string;payload:string}|null>(null);
 const playback=useRef<{url:string;context?:AudioContext;frame?:number;releaseCharacter?:()=>void}|null>(null),previewAudio=useRef<HTMLAudioElement|null>(null);
 const stopPlayback=()=>{audio.current?.pause();audio.current=null;previewAudio.current?.pause();const p=playback.current;if(p){p.releaseCharacter?.();URL.revokeObjectURL(p.url);if(p.frame)cancelAnimationFrame(p.frame);void p.context?.close();playback.current=null;}window.dispatchEvent(new CustomEvent('collabspace:voice-level',{detail:0}));window.speechSynthesis?.cancel();setSpeaking(false);};
 const release=()=>{recorder.current?.state==='recording'&&recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());clearTimeout(timer.current);};
 const cancel=()=>{epoch.current++;request.current?.abort();release();stopPlayback();if(job.current){void api.delete(`/voice/jobs/${job.current}`).catch(()=>{});pending.current=null;}job.current=null;setBusy(false);setRecording(false);};
 useEffect(()=>{
  alive.current=true;setSupported(!!navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined');const c=new AbortController();
  void api.get('/voice/status',{signal:c.signal}).then(r=>{if(alive.current){setReady(r.data.configured);setProviderName(r.data.provider==='volcengine'?'豆包语音（中国）':r.data.provider==='azure'?'Azure（'+r.data.cloud+'）':r.data.provider==='elevenlabs'?'ElevenLabs（海外）':'未识别服务');}}).catch(()=>{});
  void api.get('/voice/persona',{signal:c.signal}).then(r=>{if(alive.current&&!localeTouched.current)setLanguage(r.data.locale);}).catch(()=>{});
  const logout=()=>cancel();window.addEventListener('collabspace:logout',logout);
  return()=>{alive.current=false;c.abort();epoch.current++;request.current?.abort();release();stopPlayback();if(job.current)void api.delete(`/voice/jobs/${job.current}`).catch(()=>{});window.removeEventListener('collabspace:logout',logout);};
 // Scope is fixed by the keyed parent; cancellation captures that session only.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{if(!active)cancel();},[active]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{cancel();pending.current=null;},[text,language]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!blob){setUrl('');return;}const u=URL.createObjectURL(blob);setUrl(u);return()=>URL.revokeObjectURL(u);},[blob]);
 const start=async()=>{
  cancel();pending.current=null;setError('');setBlob(null);const n=epoch.current;
  try{
   const s=await navigator.mediaDevices.getUserMedia({audio:true});if(!alive.current||n!==epoch.current){s.getTracks().forEach(t=>t.stop());return;}stream.current=s;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
   const r=new MediaRecorder(s,mime?{mimeType:mime}:undefined);recorder.current=r;const chunks:Blob[]=[];let size=0;
   r.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);size+=e.data.size;if(size>10*1024*1024)release();}};
   r.onstop=()=>{s.getTracks().forEach(t=>t.stop());clearTimeout(timer.current);if(!alive.current||n!==epoch.current)return;setRecording(false);if(size>10*1024*1024){setError('录音超过10MB，请缩短');return;}setBlob(new Blob(chunks,{type:r.mimeType}));};
   r.onerror=()=>{release();setError('录音失败，请检查设备');setRecording(false);};r.start(250);setRecording(true);timer.current=setTimeout(()=>release(),59000);
  }catch{if(alive.current&&n===epoch.current)setError('无法使用麦克风，请允许权限并检查录音设备');}
 };
 const wait=async(id:string,c:AbortController,n:number)=>{
  for(let i=0;i<100;i++){
   if(!alive.current||n!==epoch.current)throw Error('操作已取消');
   const {data}=await api.get(`/voice/jobs/${id}`,{signal:c.signal});
   if(data.status==='SUCCEEDED')return data;
   if(['UNKNOWN','CANCELLED'].includes(data.status))throw Error(data.error||'任务已取消');
   await new Promise<void>((resolve,reject)=>{const done=()=>{c.signal.removeEventListener('abort',abort);resolve();};const t=setTimeout(done,1000);const abort=()=>{clearTimeout(t);c.signal.removeEventListener('abort',abort);reject(Error('操作已取消'));};c.signal.addEventListener('abort',abort,{once:true});});
  }throw Error('任务仍在处理，请保留录音并核查，不要重复生成');
 };
 const run=async(kind:'STT'|'TTS')=>{
  if(busy)return;stopPlayback();setError('');setBusy(true);const n=++epoch.current,c=new AbortController();request.current=c;
  try{
   const normalized=kind==='STT'?await toWav(blob!):null;
   const payload=JSON.stringify([kind,language,text,normalized?.size,blob?.size]);
   if(pending.current?.payload!==payload)pending.current={id:crypto.randomUUID(),payload};
   const id=pending.current.id;job.current=id;
   if(normalized){const form=new FormData();Object.entries({...scope,requestId:id,kind,locale:language}).forEach(([k,v])=>form.append(k,v));form.append('file',normalized,'recording.wav');await api.post('/voice/jobs',form,{signal:c.signal});}
   else await api.post('/voice/jobs',{...scope,requestId:id,kind,locale:language,text},{signal:c.signal});
   const data=await wait(id,c,n);if(!alive.current||n!==epoch.current)return;
   if(kind==='STT'){onTranscript?.(data.text);pending.current=null;job.current=null;}
   else{
    if(data.error)setError(data.error);
    const response=await api.get(`/voice/jobs/${id}/audio`,{responseType:'blob',signal:c.signal});if(!alive.current||n!==epoch.current)return;
    job.current=null;const u=URL.createObjectURL(response.data),a=new Audio(u);audio.current=a;playback.current={url:u};
    if(personaSubject){const state=useAuthStore.getState();playback.current.releaseCharacter=publishCharacter(JSON.stringify([state.currentOrgId,state.user?.id,scope.projectId||scope.conversationId,personaSubject]),{audio:a,track:Array.isArray(data.visemes)?data.visemes:[]});}
    const end=()=>{if(alive.current)stopPlayback();};a.onended=end;a.onerror=end;setSpeaking(true);await a.play();
   }
  }catch(e){if(alive.current&&n===epoch.current){stopPlayback();setError(errorText(e));}}finally{if(alive.current&&n===epoch.current)setBusy(false);}
 };
 const browserSpeak=()=>{stopPlayback();const u=new SpeechSynthesisUtterance(text.slice(0,4000));u.lang=language;u.onend=()=>setSpeaking(false);u.onerror=()=>{setSpeaking(false);setError('系统朗读失败');};setSpeaking(true);window.speechSynthesis.speak(u);};
 const sendAudio=async()=>{if(!blob||!onSendAudio||busy)return;const recordingBlob=blob;setBusy(true);setError('');const n=epoch.current;try{const wav=await toWav(blob);if(!alive.current||n!==epoch.current)return;await onSendAudio(new File([wav],'语音消息.wav',{type:'audio/wav'}));if(alive.current)setBlob(current=>current===recordingBlob?null:current);}catch(e){if(alive.current&&n===epoch.current)setError(errorText(e));}finally{if(alive.current&&n===epoch.current)setBusy(false);}};
 return <section aria-label="语音工具" className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-40">
  <div className="flex flex-wrap items-center gap-3"><label>语音语言 <select className={inputCls+' mt-1'} aria-label="语音语言" value={language} disabled={busy||recording} onChange={e=>{localeTouched.current=true;setLanguage(e.target.value);}}><option value="zh-CN">中文</option><option value="en-US">English</option></select></label>
  {onTranscript&&<Button variant="secondary" size="sm" type="button" disabled={!active||busy||!supported} onClick={recording?()=>release():()=>void start()}>{recording?'结束录音':'录音'}（最多60秒）</Button>}
  {ready&&<Button variant="secondary" size="sm" type="button" disabled={!active||busy||recording||!text.trim()||text.length>4000} onClick={()=>void run('TTS')}>生成语音朗读</Button>}
  <Button variant="secondary" size="sm" type="button" disabled={!active||busy||!text.trim()||typeof window==='undefined'||!('speechSynthesis' in window)} onClick={browserSpeak}>系统朗读（降级）</Button>
  {(busy||speaking||recording)&&<Button variant="secondary" size="sm" type="button" onClick={cancel}>停止语音</Button>}</div>
  <p className="text-xs text-slate-500">{ready?providerName+'已配置；点击转写/合成才提交内容。':'语音服务未配置，转写与云合成不可用。'}录音先留在本页；转写可修改后手动发送。系统朗读可能使用浏览器在线服务，无精确嘴型。</p>
  {url&&<div className="flex flex-wrap items-center gap-3"><audio ref={previewAudio} aria-label="录音试听" src={url} controls preload="metadata"/>{ready&&<Button variant="secondary" size="sm" type="button" disabled={busy} onClick={()=>void run('STT')}>转写到正文</Button>}{onSendAudio&&<Button variant="secondary" size="sm" type="button" disabled={busy} onClick={()=>void sendAudio()}>发送语音和当前文字</Button>}<Button variant="secondary" size="sm" type="button" disabled={busy} onClick={()=>{setBlob(null);pending.current=null;}}>丢弃录音</Button></div>}
  {busy&&<p role="status">语音处理中，请勿重复提交…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}
  {error&&blob&&!busy&&<Button variant="secondary" size="sm" type="button" onClick={()=>{pending.current=null;setError('已允许新建编号，再点击转写；可能产生新的供应商费用。');}}>已核查上次结果，允许新建转写请求</Button>}
  <Disclosure title="语音任务与恢复"><Button variant="secondary" size="sm" type="button" onClick={()=>void api.get('/voice/jobs',{params:scope}).then(r=>setHistory(r.data)).catch(()=>setError('任务记录加载失败'))}>刷新语音任务</Button><p className="text-xs">任务保留24小时。UNKNOWN需先核查，不自动重试；刷新后原始本地录音不恢复。</p>{history.map(j=><div key={j.id} className="break-all text-xs">{j.kind} · {j.status} · {j.id}{j.text&&onTranscript&&<Button variant="secondary" size="sm" type="button" onClick={()=>onTranscript(j.text)}>恢复转写文字</Button>}</div>)}</Disclosure>
 </section>;
}

export function PrivateAudio({attachmentId}:{attachmentId:string}){
 const org=useAuthStore(s=>s.currentOrgId),[url,setUrl]=useState(''),[error,setError]=useState('');
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setUrl('');return()=>{generation.current++;};},[attachmentId,org]);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 const load=async()=>{const n=generation.current;try{const r=await api.get(`/messages/attachments/${attachmentId}/download`,{responseType:'blob'});if(n===generation.current)setUrl(URL.createObjectURL(r.data));}catch{setError('无法加载语音，请检查权限后重试');}};
 return <div>{url?<audio aria-label="语音消息" src={url} controls/>:<Button variant="secondary" size="sm" type="button" onClick={()=>void load()}>加载语音（鉴权）</Button>}{error&&<p role="alert">{error}</p>}</div>;
}
