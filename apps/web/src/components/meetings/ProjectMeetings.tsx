'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import MeetingDevices,{type MeetingDeviceSelection} from './MeetingDevices';
import {Room,RoomEvent,Track,type Participant} from 'livekit-client';
import {useProjectRealtime} from '@/lib/use-realtime';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';

type Meeting={id:string;title:string;status:'ACTIVE'|'ENDING'|'ENDED';host_id:string};
const labels={ACTIVE:'可加入',ENDING:'正在结束，等待确认',ENDED:'已结束'};
const message=(e:any)=>e.response?.data?.message||e.message||'操作失败，请重试';
export default function ProjectMeetings({projectId}:{projectId:string}){
 const org=useAuthStore(s=>s.currentOrgId);
 return <Meetings key={org+':'+projectId} projectId={projectId} org={org}/>;
}
function Meetings({projectId,org}:{projectId:string;org:string|null}){
 const me=useAuthStore(s=>s.user),[rows,setRows]=useState<Meeting[]>([]),[status,setStatus]=useState<any>(null),[title,setTitle]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[call,setCall]=useState<Meeting|null>(null),[reload,setReload]=useState(0),[requestId,setRequestId]=useState(''),[chat,setChat]=useState<Meeting|null>(null);
 const [devices,setDevices]=useState<MeetingDeviceSelection>({});
 const [attempt,setAttempt]=useState(0);
 useProjectRealtime(org,projectId,undefined,()=>setReload(x=>x+1));
 const alive=useRef(true),pending=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  const abort=new AbortController();let active=true;
  const refresh=async()=>{try{
   const options={headers:{'x-organization-id':org},signal:abort.signal};
   const s=await api.get('/meetings/status',options);if(!active)return;setStatus(s.data);
   if(s.data.enabled){const r=await api.get('/meetings',{...options,params:{projectId}});if(active)setRows(r.data);}
  }catch(e){if(active)setError(message(e));}};
  void refresh();const timer=setInterval(refresh,5000);return()=>{active=false;abort.abort();clearInterval(timer);};
 },[projectId,org,reload]);
 async function create(e:React.FormEvent){
  e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');const id=requestId||crypto.randomUUID();setRequestId(id);
  try{await api.post('/meetings',{projectId,title,requestId:id},{headers:{'x-organization-id':org}});if(alive.current){setRequestId('');setTitle('');setReload(x=>x+1);}}
  catch(e){if(alive.current)setError(message(e));}finally{pending.current=false;if(alive.current)setBusy(false);}
 }
 async function end(id:string){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{await api.post('/meetings/'+id+'/end',{}, {headers:{'x-organization-id':org}});if(alive.current){if(call?.id===id)setCall(null);setReload(x=>x+1);}}
  catch(e){if(alive.current){setError(message(e));setReload(x=>x+1);}}finally{pending.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{if(call&&rows.some(r=>r.id===call.id&&r.status!=='ACTIVE'))setCall(null);},[rows,call]);
 return <main className="mx-auto max-w-6xl space-y-5 p-6">
  <Link href={'/projects/'+projectId} className="text-sm text-indigo-700">返回项目</Link><h1 className="text-2xl font-semibold">项目视频会议</h1>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {!status?<p>正在检查会议服务…</p>:!status.enabled?<p role="status">会议功能尚未启用。</p>:<>
   {!status.configured&&<p role="status" className="rounded-lg bg-amber-50 p-3">{status.reason||'音视频服务尚未配置。可以创建和管理会议，配置完成后加入通话。'}</p>}
   <MeetingDevices active={!call} selection={devices} onChange={setDevices}/>
   <form onSubmit={create} className="flex flex-wrap gap-3">
    <input aria-label="会议名称" className="rounded border p-2" value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required readOnly={busy||!!requestId} placeholder="会议名称"/>
    <button className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>{requestId?'重试创建':'创建会议'}</button>
    {!!requestId&&!busy&&<button type="button" onClick={()=>{setRequestId('');setTitle('');setError('请先刷新列表核对上次创建结果，再创建新会议。');}}>清除草稿</button>}
   </form>
   <ul className="space-y-3">{rows.map(r=><li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4"><strong className="mr-auto">{r.title}</strong><span>{labels[r.status]}</span>
    {r.status==='ACTIVE'&&<button disabled={!status.configured||busy||!!call} onClick={()=>setCall(r)} className="rounded border px-3 py-1 disabled:opacity-50">加入会议</button>}
    <button onClick={()=>setChat(r)} className="rounded border px-3 py-1">聊天记录</button>
    {r.host_id===me?.id&&r.status!=='ENDED'&&<button disabled={busy} onClick={()=>end(r.id)} className="rounded border px-3 py-1">{r.status==='ENDING'?'重试确认结束':'结束会议'}</button>}
   </li>)}</ul>
   {!rows.length&&<p className="text-slate-500">还没有会议。</p>}
   {chat&&<MeetingChat key={'chat:'+chat.id} meeting={rows.find(r=>r.id===chat.id)||chat} reload={reload} org={org} onClose={()=>setChat(null)}/>}
   {call&&<MeetingCall key={'call:'+call.id+':'+attempt} meeting={call} org={org} devices={devices} onLeave={()=>setCall(null)} onRetry={()=>setAttempt(x=>x+1)}/>}
  </>}
 </main>;
}
function TrackView({track,source}:{track:Track;source:string}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const element=track.attach();element.autoplay=true;if(element instanceof HTMLVideoElement){element.playsInline=true;element.className='aspect-video w-full rounded bg-slate-900 object-contain';}root.current?.appendChild(element);return()=>{track.detach(element);element.remove();};},[track]);
 return <div ref={root} data-track-source={source}/>;
}
function MeetingCall({meeting,org,devices,onLeave,onRetry}:{meeting:Meeting;org:string|null;devices:MeetingDeviceSelection;onLeave:()=>void;onRetry:()=>void}){
 const [room,setRoom]=useState<Room|null>(null),[state,setState]=useState('正在加入'),[error,setError]=useState(''),[needsRejoin,setNeedsRejoin]=useState(false),[,bump]=useState(0),[busy,setBusy]=useState(false),activeRef=useRef(true);
 useEffect(()=>{
  const room=new Room({adaptiveStream:true,dynacast:true});setRoom(room);
  let active=true;activeRef.current=true;const abort=new AbortController(),changed=()=>{if(active)bump(x=>x+1);};
  const connected=()=>{if(active&&room.state==='connected')setState('已连接');},reconnecting=()=>{if(active)setState('正在重新连接');},disconnected=()=>{if(active){setState('连接已断开，请重新验证入会');bump(x=>x+1);}};
  const events=[RoomEvent.TrackSubscribed,RoomEvent.TrackUnsubscribed,RoomEvent.LocalTrackPublished,RoomEvent.LocalTrackUnpublished,RoomEvent.TrackMuted,RoomEvent.TrackUnmuted,RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.AudioPlaybackStatusChanged];
  for(const event of events)room.on(event,changed);
  room.on(RoomEvent.Connected,connected).on(RoomEvent.Reconnected,connected).on(RoomEvent.Reconnecting,reconnecting).on(RoomEvent.Disconnected,disconnected);
  (async()=>{try{const r=await api.post('/meetings/'+meeting.id+'/join',{}, {headers:{'x-organization-id':org},signal:abort.signal});if(!active)return;await room.connect(r.data.url,r.data.token);if(!active){await room.disconnect();return;}await room.startAudio().catch(()=>{if(active)setError('浏览器尚未允许播放声音，请点击启用扬声器。');});connected();}catch(e){if(active){setError(message(e));setState('加入失败');await room.disconnect();}}})();
  const close=()=>{void room.disconnect();};window.addEventListener('collabspace:logout',close);window.addEventListener('beforeunload',close);
  return()=>{active=false;activeRef.current=false;abort.abort();for(const event of events)room.off(event,changed);room.off(RoomEvent.Connected,connected).off(RoomEvent.Reconnected,connected).off(RoomEvent.Reconnecting,reconnecting).off(RoomEvent.Disconnected,disconnected);window.removeEventListener('collabspace:logout',close);window.removeEventListener('beforeunload',close);void room.disconnect();};
 },[meeting.id,org]);
 async function toggle(source:'microphone'|'camera'|'screen'){
  if(busy||!room||room.state!=='connected')return;setBusy(true);setError('');setNeedsRejoin(false);try{const p=room.localParticipant;
   if(source==='microphone')await p.setMicrophoneEnabled(!p.isMicrophoneEnabled,devices.microphone?{deviceId:devices.microphone}:undefined);
   if(source==='camera')await p.setCameraEnabled(!p.isCameraEnabled,devices.camera?{deviceId:devices.camera}:undefined);
   if(source==='screen')await p.setScreenShareEnabled(!p.isScreenShareEnabled);
   if(!activeRef.current){await room.disconnect();return;}bump(x=>x+1);
  }catch(e){if(activeRef.current){const detail=message(e),timeout=/timed out|timeout|negotiation/i.test(detail);setNeedsRejoin(timeout);setError(timeout?'媒体协商未获服务器确认，请重新验证入会，再手动开启设备。':detail);}}finally{if(activeRef.current)setBusy(false);}
 }
 if(!room)return <section aria-label="会议通话">正在准备通话…</section>;
 const participants:Participant[]=[room.localParticipant,...Array.from(room.remoteParticipants.values())];
 return <section className="space-y-4 rounded-xl border bg-slate-50 p-4" aria-label="会议通话">
  <h2>{meeting.title} · {state}</h2><p className="text-sm text-slate-600">默认关闭麦克风和摄像头，请按需开启。</p>
  <div className="flex flex-wrap gap-2">
   {(needsRejoin||state==='加入失败'||state==='正在重新连接'||state.startsWith('连接已断开'))&&<button disabled={busy} onClick={()=>{void(async()=>{setBusy(true);try{await room.disconnect();if(activeRef.current)onRetry();}catch{if(activeRef.current){setError('连接清理失败，请离开会议后重试。');setBusy(false);}}})();}} className="rounded border p-2">重新验证并入会</button>}
   <button disabled={busy||room.state!=='connected'} onClick={()=>toggle('microphone')} className="rounded border p-2">{room.localParticipant.isMicrophoneEnabled?'关闭麦克风':'开启麦克风'}</button>
   <button disabled={busy||room.state!=='connected'} onClick={()=>toggle('camera')} className="rounded border p-2">{room.localParticipant.isCameraEnabled?'关闭摄像头':'开启摄像头'}</button>
   <button disabled={busy||room.state!=='connected'} onClick={()=>toggle('screen')} className="rounded border p-2">{room.localParticipant.isScreenShareEnabled?'停止共享':'共享屏幕'}</button>
   {!room.canPlaybackAudio&&<button onClick={()=>{void room.startAudio().then(()=>setError('')).catch(()=>setError('无法播放声音，请检查浏览器权限。'));}} className="rounded border p-2">启用扬声器</button>}
   <button onClick={()=>{void room.disconnect();onLeave();}} className="rounded border p-2">离开会议</button>
  </div>{error&&<p role="alert" className="text-red-700">{error}</p>}
  <div className="grid gap-3 md:grid-cols-2">{participants.map((p,index)=><div key={p.identity||'local'} className="rounded border p-3"><p>{p===room.localParticipant?'我':'参会者 '+index}</p>{Array.from(p.trackPublications.values()).filter(pub=>pub.track&&!pub.isMuted&&(p!==room.localParticipant||pub.track.kind==='video')).map(pub=><TrackView key={pub.trackSid} track={pub.track!} source={pub.source}/>)}</div>)}</div>
 </section>;
}


type ChatMessage={id:string;sender_id:string;body:string;created_at:string};
function MeetingChat({meeting,org,reload,onClose}:{meeting:Meeting;org:string|null;reload:number;onClose:()=>void}){
 const me=useAuthStore(s=>s.user),[messages,setMessages]=useState<ChatMessage[]>([]),[text,setText]=useState(''),[requestId,setRequestId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[more,setMore]=useState(true);
 const active=useRef(true),pending=useRef(false),oldest=useRef('');
 const merge=(rows:ChatMessage[])=>setMessages(current=>Array.from(new Map([...current,...rows].map(m=>[m.id,m])).values()).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)));
 useEffect(()=>{active.current=true;const abort=new AbortController();
  const refresh=async()=>{try{const r=await api.get('/meetings/'+meeting.id+'/messages',{headers:{'x-organization-id':org},signal:abort.signal});if(active.current){merge(r.data);if(!oldest.current){oldest.current=r.data.at(-1)?.id||'';setMore(r.data.length===100);}}}catch(e){if(!abort.signal.aborted&&active.current)setError(message(e));}};
  void refresh();const timer=setInterval(refresh,3000);return()=>{active.current=false;abort.abort();clearInterval(timer);};
 },[meeting.id,org,reload]);
 async function history(){if(pending.current)return;pending.current=true;setBusy(true);try{const r=await api.get('/meetings/'+meeting.id+'/messages',{headers:{'x-organization-id':org},params:{before:oldest.current}});if(active.current){merge(r.data);oldest.current=r.data.at(-1)?.id||oldest.current;setMore(r.data.length===100);}}catch(e){if(active.current)setError(message(e));}finally{pending.current=false;if(active.current)setBusy(false);}}
 async function send(e:React.FormEvent){e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');const id=requestId||crypto.randomUUID();setRequestId(id);
  try{const r=await api.post('/meetings/'+meeting.id+'/messages',{requestId:id,text},{headers:{'x-organization-id':org}});if(active.current){merge([r.data]);setText('');setRequestId('');}}
  catch(e){if(active.current)setError(message(e));}finally{pending.current=false;if(active.current)setBusy(false);}}
 return <section aria-label="会议聊天" className="space-y-3 rounded-xl border p-4"><div className="flex justify-between"><h2>{meeting.title} · 聊天记录</h2><button onClick={onClose}>关闭聊天</button></div>
 <p className="text-sm text-slate-500">消息保存在项目中，每3秒同步；会议结束后仍可查看。</p>
 {more&&<button disabled={busy} onClick={history}>加载更早消息</button>}
 <ol className="max-h-80 space-y-2 overflow-y-auto">{messages.map(m=><li key={m.id}><small>{m.sender_id===me?.id?'我':'项目成员'} · {new Date(m.created_at).toLocaleString()}</small><p className="whitespace-pre-wrap break-words">{m.body}</p></li>)}</ol>
 {error&&<p role="alert" className="text-red-700">{error}</p>}
 <form onSubmit={send} className="flex gap-2"><textarea aria-label="会议消息" value={text} onChange={e=>setText(e.target.value)} maxLength={2000} required readOnly={busy||!!requestId} disabled={meeting.status!=='ACTIVE'} className="flex-1 rounded border p-2"/><button disabled={busy||meeting.status!=='ACTIVE'}>{requestId?'重试发送':'发送消息'}</button></form>
 </section>;
}
