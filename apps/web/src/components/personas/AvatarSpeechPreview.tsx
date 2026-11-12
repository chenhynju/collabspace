'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';
import {publishCharacter} from './character-playback';
import type {VisemeFrame} from './character-catalog';

export default function AvatarSpeechPreview({projectId,onProjectChange}:{projectId:string;onProjectChange:(id:string)=>void}){
 const [projects,setProjects]=useState<{id:string;name:string}[]>([]),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();void api.get('/projects',{signal:c.signal}).then(r=>{if(!c.signal.aborted){const rows=Array.isArray(r.data)?r.data:[];setProjects(rows);if(!projectId&&rows.length)onProjectChange(rows[0].id);}}).catch(()=>{if(!c.signal.aborted)setError('项目列表加载失败');});return()=>c.abort();},[onProjectChange]); // eslint-disable-line react-hooks/exhaustive-deps
 return <section aria-label="基础口型语音预览" className="mx-auto max-w-6xl space-y-2 px-6 pt-5"><h2 className="font-semibold">用已生成的语音验证嘴型</h2><p className="text-sm text-slate-600">复用当前账号在项目中的朗读，不重新合成、不新增云语音请求。当前人物是第三方技术样例，基础音素口型需人工确认，尚非20款定制成品。</p><label className="flex items-center gap-2 text-sm">项目<select aria-label="口型预览项目" value={projectId} onChange={e=>onProjectChange(e.target.value)} className="rounded border p-2"><option value="">请选择项目</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{projectId&&<SpeechSession key={projectId} projectId={projectId}/>} {error&&<p role="alert">{error}</p>}</section>;
}
function SpeechSession({projectId}:{projectId:string}){
 const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id),[jobs,setJobs]=useState<any[]>([]),[selected,setSelected]=useState(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const audio=useRef<HTMLAudioElement|null>(null),track=useRef<VisemeFrame[]>([]),release=useRef<(()=>void)|null>(null),blobUrl=useRef(''),generation=useRef(0),request=useRef<AbortController>();
 const stopCharacter=()=>{const stop=release.current;release.current=null;stop?.();};
 const dispose=()=>{generation.current++;request.current?.abort();audio.current?.pause();stopCharacter();if(blobUrl.current)URL.revokeObjectURL(blobUrl.current);blobUrl.current='';};
 useEffect(()=>{const c=new AbortController();void api.get('/voice/jobs',{params:{projectId},signal:c.signal}).then(r=>{if(!c.signal.aborted){const rows=(r.data as any[]).filter(j=>j.kind==='TTS'&&j.status==='SUCCEEDED'&&j.hasAudio);setJobs(rows);setSelected(rows[0]?.id||'');}}).catch(()=>{if(!c.signal.aborted)setNotice('朗读记录加载失败');});const logout=()=>{dispose();setUrl('');setBusy(false);};window.addEventListener('collabspace:logout',logout);return()=>{c.abort();dispose();window.removeEventListener('collabspace:logout',logout);};},[projectId]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(url)void audio.current?.play().catch(()=>setNotice('音频已准备，请点击播放器开始。'));},[url]);
 const play=async()=>{
  dispose();setUrl('');setNotice('');setBusy(true);const n=generation.current,c=new AbortController();request.current=c;
  try{const result=await api.post(`/voice/jobs/${selected}/mouth-track`,{}, {signal:c.signal});const media=await api.get(`/voice/jobs/${selected}/audio`,{responseType:'blob',signal:c.signal});if(c.signal.aborted||n!==generation.current)return;track.current=result.data.visemes||[];blobUrl.current=URL.createObjectURL(media.data);setUrl(blobUrl.current);setNotice(track.current.some(f=>f.source==='rhubarb-phonetic-v1')?'基础音素口型已准备；它不是逐字精确标注。':'已复用供应商口型轨道。');}
  catch(e:any){if(!c.signal.aborted&&n===generation.current)setNotice(e.response?.data?.message||'口型预览失败，原朗读保留。');}
  finally{if(n===generation.current)setBusy(false);}
 };
 const epoch=generation.current;
 return <div className="space-y-2 rounded-lg border p-3"><div className="flex flex-wrap items-center gap-3"><select aria-label="选择已有朗读" value={selected} disabled={busy} onChange={e=>{dispose();setUrl('');setBusy(false);setSelected(e.target.value);}} className="rounded border p-2"><option value="">暂无可用朗读</option>{jobs.map((j,i)=><option key={j.id} value={j.id}>{j.locale==='zh-CN'?'中文':'English'}朗读 {i+1}</option>)}</select><button disabled={busy||!selected} onClick={()=>void play()} className="rounded border px-3 py-2 disabled:opacity-50">{busy?'正在分析基础口型…':'分析口型并播放'}</button><button disabled={!busy&&!url} onClick={()=>{dispose();setUrl('');setBusy(false);}} className="rounded border px-3 py-2 disabled:opacity-50">停止口型预览</button></div><audio key={url||'empty'} ref={node=>{if(node)audio.current=node;}} aria-label="口型预览音频" src={url||undefined} controls className={url?'':'hidden'} onPlay={e=>{if(epoch!==generation.current){e.currentTarget.pause();return;}release.current=publishCharacter(JSON.stringify([org,user,projectId,'assistant']),{audio:e.currentTarget,track:track.current});}} onPause={e=>{if(epoch===generation.current&&e.currentTarget.paused)stopCharacter();}} onEnded={e=>{if(epoch===generation.current&&e.currentTarget.ended)stopCharacter();}}/>{notice&&<p role="status" className="text-sm">{notice}</p>}{!jobs.length&&<p className="text-sm text-slate-500">请先在项目助手中生成一段朗读，再重新打开此页。</p>}</div>;
}
