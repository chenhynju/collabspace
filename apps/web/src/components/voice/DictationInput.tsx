'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,Check,X,Loader2} from 'lucide-react';
import {api} from '@/lib/api';
import {toWav} from './audio';

/** Dictation produces an editable draft. It has no message-send authority. */
export function DictationInput({conversationId,active=true,onTranscript,onBusyChange}:{conversationId:string;active?:boolean;onTranscript:(text:string)=>void;onBusyChange:(busy:boolean)=>void}){
 const [stage,setStage]=useState<'idle'|'requesting'|'recording'|'review'|'transcribing'>('idle'),[ready,setReady]=useState<boolean|null>(null),[error,setError]=useState(''),[seconds,setSeconds]=useState(0),[level,setLevel]=useState(0),[saved,setSaved]=useState('');
 const alive=useRef(true),epoch=useRef(0),stream=useRef<MediaStream|null>(null),recorder=useRef<MediaRecorder|null>(null),abort=useRef<AbortController|null>(null),job=useRef<string|null>(null),media=useRef<Blob|null>(null),limit=useRef<ReturnType<typeof setTimeout>>(),clock=useRef<ReturnType<typeof setInterval>>(),frame=useRef(0),context=useRef<AudioContext|null>(null);
 const finishRequested=useRef(false);
 const [locale,setLocale]=useState('zh-CN');
 const localeEdited=useRef(false);
 const release=()=>{clearTimeout(limit.current);clearInterval(clock.current);cancelAnimationFrame(frame.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;void context.current?.close().catch(()=>{});context.current=null;};
 const cancel=()=>{epoch.current++;finishRequested.current=false;abort.current?.abort();release();if(job.current)void api.delete(`/voice/jobs/${job.current}`).catch(()=>{});job.current=null;if(alive.current){setStage('idle');setLevel(0);}};
 useEffect(()=>{onBusyChange(stage!=='idle');},[stage,onBusyChange]);
 useEffect(()=>{alive.current=true;const c=new AbortController();void api.get('/voice/status',{signal:c.signal}).then(r=>{if(alive.current)setReady(r.data.configured===true);}).catch(()=>{if(alive.current)setReady(false);});void api.get('/voice/persona',{signal:c.signal}).then(r=>{if(alive.current&&!localeEdited.current)setLocale(r.data.locale==='en-US'?'en-US':'zh-CN');}).catch(()=>{});return()=>{alive.current=false;c.abort();cancel();};},[]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!active)cancel();},[active]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>()=>{if(saved)URL.revokeObjectURL(saved);},[saved]);
 const transcribe=async(blob:Blob,n:number)=>{
  if(!alive.current||n!==epoch.current||job.current)return;
  setStage('transcribing');const c=new AbortController();abort.current=c;const id=crypto.randomUUID();job.current=id;
  try{
   const wav=await toWav(blob);if(!alive.current||n!==epoch.current)return;
   const form=new FormData();form.append('requestId',id);form.append('conversationId',conversationId);form.append('kind','STT');form.append('locale',locale);form.append('file',wav,'dictation.wav');
   await api.post('/voice/jobs',form,{signal:c.signal});
   for(let i=0;i<100;i++){
    if(!alive.current||n!==epoch.current)return;
    const {data}=await api.get(`/voice/jobs/${id}`,{signal:c.signal});
    if(data.status==='SUCCEEDED'){
     if(typeof data.text!=='string'||!data.text.trim())throw Error('没有识别到文字，请重录。');
     onTranscript(data.text.trim());media.current=null;setSaved('');job.current=null;setStage('idle');return;
    }
    if(['UNKNOWN','CANCELLED'].includes(data.status))throw Error(data.error||'转写结果待核查，不会自动重试。');
    await new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(Error('已取消'));};const timer=setTimeout(()=>{c.signal.removeEventListener('abort',stop);resolve();},1000);c.signal.addEventListener('abort',stop,{once:true});});
   }
   throw Error('转写仍未确认，请在语音选项中核查任务；不会自动重试。');
  }catch(e:any){if(alive.current&&n===epoch.current){setError(e.response?.data?.message||e.message||'转写失败，请核查后重试。');setStage('idle');}}
 };
 const start=async()=>{
  if(!ready){setError('语音输入尚未启用。管理员配置Azure后即可使用；你仍可通过语音选项发送原音。');return;}
  if(job.current){setError('上次转写结果待核查，请先在语音选项中检查任务，避免重复计费。');return;}
  cancel();setError('');setSaved('');setSeconds(0);media.current=null;setStage('requesting');const n=epoch.current;
  try{
   const captured=await navigator.mediaDevices.getUserMedia({audio:true});if(!alive.current||n!==epoch.current){captured.getTracks().forEach(t=>t.stop());return;}stream.current=captured;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));const r=new MediaRecorder(captured,mime?{mimeType:mime}:undefined),chunks:Blob[]=[];let bytes=0;recorder.current=r;
   r.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>10*1024*1024){finishRequested.current=false;release();}}};
   r.onstop=()=>{release();if(!alive.current||n!==epoch.current)return;if(bytes>10*1024*1024){setError('录音超过上限，请缩短后重录。');setStage('idle');return;}const blob=new Blob(chunks,{type:r.mimeType});media.current=blob;setSaved(URL.createObjectURL(blob));if(finishRequested.current)void transcribe(blob,n);else setStage('review');};
   r.onerror=()=>{cancel();setError('录音失败，请检查麦克风。');};r.start(250);setStage('recording');const began=performance.now();clock.current=setInterval(()=>setSeconds(Math.floor((performance.now()-began)/1000)),250);limit.current=setTimeout(()=>{finishRequested.current=false;release();},59000);
   try{const ac=new AudioContext(),analyser=ac.createAnalyser();context.current=ac;ac.createMediaStreamSource(captured).connect(analyser);analyser.fftSize=256;const data=new Uint8Array(256);let last=0;const tick=()=>{if(!alive.current||n!==epoch.current||context.current!==ac)return;if(performance.now()-last>80){analyser.getByteTimeDomainData(data);setLevel(Math.min(1,Math.sqrt(data.reduce((sum,v)=>sum+((v-128)/128)**2,0)/data.length)*6));last=performance.now();}frame.current=requestAnimationFrame(tick);};tick();void ac.resume().catch(()=>{});}catch{/* Recording works even if a visual analyser is unavailable. */}
  }catch{if(alive.current&&n===epoch.current){release();setStage('idle');setError('无法使用麦克风，请允许浏览器访问后重试。');}}
 };
 return <div className="min-w-0 flex-1">
  {stage==='idle'?<button type="button" aria-label="语音输入" title="单次最多60秒，确认后转写为可编辑文字" disabled={!active||ready===null} onClick={()=>void start()} className="flex h-9 items-center gap-2 rounded-full px-3 text-slate-600 hover:bg-slate-100 disabled:opacity-40"><Mic size={18}/><span className="hidden sm:inline">语音输入</span></button>:
   <div aria-label="语音输入状态" className="flex items-center gap-3 rounded-full bg-slate-100 px-3 py-2">
    <button type="button" aria-label="取消听写" title="取消听写" onClick={cancel} className="rounded-full p-1 hover:bg-white"><X size={18}/></button>
    {stage==='recording'?<>
     <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/><span className="text-xs tabular-nums">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} / 1:00</span>
     <div className="flex h-6 flex-1 items-center justify-center gap-1" role="meter" aria-label="麦克风音量" aria-valuenow={Math.round(level*100)} aria-valuemin={0} aria-valuemax={100}>{Array.from({length:14},(_,i)=><span key={i} className="w-1 rounded-full bg-slate-600 transition-[height]" style={{height:3+level*(8+(i%4)*5)}}/>)}</div>
     <button type="button" aria-label="确认转写" title="确认转写" onClick={()=>{finishRequested.current=true;release();}} className="rounded-full bg-slate-900 p-2 text-white"><Check size={16}/></button>
    </>:stage==='review'?<><span role="status" className="flex-1 text-xs">录音已结束，确认后转写</span><button type="button" aria-label="确认转写" title="确认转写" onClick={()=>{if(media.current)void transcribe(media.current,epoch.current);}} className="rounded-full bg-slate-900 p-2 text-white"><Check size={16}/></button></>:
     <span role="status" className="flex flex-1 items-center gap-2 text-xs"><Loader2 size={16} className="animate-spin"/>{stage==='requesting'?'等待麦克风权限…':'正在转写…'}</span>}
   </div>}
  {(stage==='recording'||stage==='review')&&<p className="mt-1 px-3 text-xs text-slate-400">确认后提交Azure转写；文字回填草稿，不自动发送。</p>}
  {stage==='idle'&&ready&&<label className="px-3 text-xs text-slate-400"><span className="sr-only">听写语言</span><select aria-label="听写语言" value={locale} disabled={!!job.current} onChange={e=>{localeEdited.current=true;setLocale(e.target.value);}} className="bg-transparent"><option value="zh-CN">中文听写</option><option value="en-US">English dictation</option></select></label>}
  {error&&<div role="alert" aria-label="听写提示" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{error}{saved&&<a href={saved} download="dictation-recording" className="ml-2 underline">保存本地录音</a>}{job.current&&<button type="button" onClick={()=>{cancel();setError('已结束本次请求；供应商可能已计费。再次录音会创建新任务。');}} className="ml-2 underline">结束本次转写</button>}</div>}
 </div>;
}
