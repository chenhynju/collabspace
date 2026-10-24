'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {displayDate} from '@/lib/display-date';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';
import {useRouter} from 'next/navigation';

export default function OfficePage({params}:{params:{id:string}}){
 const router=useRouter(),restoreIds=useRef<Record<string,string>>({});
 const org=useAuthStore(s=>s.currentOrgId),[state,setState]=useState<any>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[members,setMembers]=useState<any[]>([]),[grants,setGrants]=useState<any[]>([]),[target,setTarget]=useState(''),[role,setRole]=useState('EDITOR'),[epoch,setEpoch]=useState(0);
 const editor=useRef<any>(null),alive=useRef(false),inFlight=useRef(false),base='/office/'+params.id;
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let active=true;alive.current=true;setReady(false);setState(null);setError('');setMessage('正在载入 Office 编辑服务…');setMembers([]);setGrants([]);
  const headers={'x-organization-id':org};let sessionId:string|undefined,waitingClose=false;
  const stop=()=>{editor.current?.destroyEditor();editor.current=null;if(active)setReady(false)};
  const poll=async()=>{if(inFlight.current)return;inFlight.current=true;try{const r=await api.get(base+'/state',{headers,params:{sessionId}});if(!active)return;setState(r.data);if(r.data.phase==='FROZEN'){stop();setError('会话已冻结：权限变更、连接过期或保存冲突。未确认的保存会保留为恢复候选。')}else if(r.data.phase==='CLOSING'){waitingClose=true;stop();setMessage('正在等待上一轮编辑的最终保存完成，请稍候。')}else if(r.data.phase==='CLOSED'&&(sessionId||waitingClose)){waitingClose=true;stop();setEpoch(v=>v+1)}else if(waitingClose&&!editor.current){setEpoch(v=>v+1)}}catch(e:any){if(active){if([401,403,404].includes(e.response?.status)){stop();setError('访问已撤销或登录已失效。')}else setMessage('网络中断，尚未确认服务器保存；请保留编辑器并重试。')}}finally{inFlight.current=false}};
  void api.post(base+'/config',{}, {headers}).then(async r=>{
   if(!active)return;
   sessionId=r.data.sessionId;
   if(!(window as any).DocsAPI)await new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src=r.data.publicUrl.replace(/\/$/,'')+'/web-apps/apps/api/documents/api.js';s.onload=()=>resolve();s.onerror=()=>reject(Error('编辑服务加载失败'));document.head.appendChild(s)});
   if(!active)return;
   editor.current=new (window as any).DocsAPI.DocEditor('office-editor',{...r.data.config,events:{onDocumentReady:()=>{if(active){setReady(true);setMessage('编辑器已连接；“编辑器已保存”与服务器版本号分别核对。')}},onDocumentStateChange:(e:any)=>{if(active&&e.data)setMessage('正在编辑，等待服务器保存确认。')},onError:(e:any)=>{if(active)setMessage('编辑服务错误 '+String(e.data?.errorCode??'UNKNOWN')+'，请保留当前页面并检查保存状态。')}}});
   await poll();
   if(r.data.role==='OWNER'){const results=await Promise.all([api.get('/members',{headers}),api.get('/documents/'+params.id+'/grants',{headers})]);if(active){setMembers(results[0].data);setGrants(results[1].data)}}
  }).catch((e:any)=>{if(active){if(e.response?.data?.code==='OFFICE_CLOSING'){waitingClose=true;setMessage('正在等待上一轮编辑的最终保存完成，请稍候。')}else setError(e.response?.data?.code==='OFFICE_NOT_CONFIGURED'?'Office 编辑服务尚未配置。':e.response?.data?.code==='OFFICE_RECOVERY_REQUIRED'?'会话需要所有者确认恢复。':e.message||'无法打开 Office 文件。')}void poll()});
  const timer=setInterval(()=>{void poll()},2000);
  return()=>{active=false;alive.current=false;clearInterval(timer);stop()};
 },[base,org,epoch,params.id]);
 const download=async(version?:string)=>{try{const r=await api.get(base+'/download',{params:{version},responseType:'blob'});const url=URL.createObjectURL(r.data),a=document.createElement('a');a.href=url;a.download=state?.title||'document';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{setMessage('下载失败，请检查权限或网络。')}};
 return <main className="min-h-screen bg-slate-50 p-4 space-y-4 lg:p-6">
  <header className="flex flex-wrap gap-3 items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><Link className="text-sm text-slate-500" href={state?.projectId?'/projects/'+state.projectId+'/content':'/collaboration'}>← 协作空间</Link><h1 className="font-semibold text-xl">{state?.title||'Office 协作文件'}</h1><p className="mt-1 text-xs text-slate-500">{state?.role==='OWNER'?'所有者':state?.role==='EDITOR'?'可编辑':state?.role==='VIEWER'?'只读':'正在验证权限'}</p></div><div className="flex flex-wrap items-center gap-3"><div aria-label="Office 在线参与者">{state?.users?.map((u:any)=><span className="mx-2" key={u.id}>{u.name}</span>)}</div><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>{const el=document.getElementById('office-history');el?.setAttribute('open','');el?.scrollIntoView({behavior:'smooth'});}}>历史版本</button>{state?.role==='OWNER'&&<button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>document.getElementById('office-access')?.scrollIntoView({behavior:'smooth'})}>共享权限</button>}</div></header>
  <div className="flex flex-wrap gap-3 items-center rounded-xl border border-slate-200 bg-white p-3 text-sm"><span role="status">服务器版本 v{state?.revision||'—'} · {state?.phase||'正在连接'}</span><button className="px-3 py-1 border rounded" disabled={!['OWNER','EDITOR'].includes(state?.role)||state?.phase!=='OPEN'} onClick={async()=>{try{const r=await api.post(base+'/save');setMessage(r.data.error===0?'已请求检查点；请等待服务器版本号更新。':r.data.error===4?'引擎没有新增更改。':'检查点请求失败。')}catch{setMessage('保存请求失败，内容未确认持久化。')}}}>保存到服务器</button><button className="px-3 py-1 border rounded" onClick={()=>download()}>下载最新保存版本</button></div>
  {error&&<p role="alert" className="text-red-700">{error}</p>}<p className="text-sm text-slate-500">{message}</p>
  {state?.error&&state.phase!=='FROZEN'&&<p role="alert" className="text-amber-700">有未合并的保存结果，请文件所有者检查“恢复候选”；当前显示的版本号仅代表已确认保存。</p>}
  {state?.phase==='FROZEN'&&state?.role==='OWNER'&&<button className="border p-2" onClick={async()=>{try{await api.post(base+'/restart',{generation:state.generation});setEpoch(v=>v+1)}catch{setMessage('恢复失败，请重新核对会话状态。')}}}>确认从最后保存版本重新打开（不合并恢复候选）</button>}
  <details className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-slate-700">
   <summary className="cursor-pointer font-medium text-indigo-900">编辑工具在哪里？工作表、函数、图片与图形</summary>
   <div className="mt-3 grid gap-4 md:grid-cols-3">
    <section><h2 className="font-semibold">表格 · .xlsx</h2><p className="mt-1 leading-6">底部工作表标签旁的 ＋ 新建工作表；选中单元格，在公式栏输入 =VLOOKUP(...)，也可从“公式”选项卡插入函数。</p><code className="mt-2 block break-all text-xs">=VLOOKUP(A2,$D$2:$E$10,2,FALSE)</code></section>
    <section><h2 className="font-semibold">幻灯片 · .pptx</h2><p className="mt-1 leading-6">打开编辑器顶部“插入”选项卡，选择“形状”“图片”或“文本框”。选中对象后拖动位置与控制点，调整尺寸和样式。</p></section>
    <section><h2 className="font-semibold">文档 · .docx</h2><p className="mt-1 leading-6">“开始”调整文字与段落；“插入”添加图片、表格和链接。只读成员无法使用编辑工具。旧 .xls 请先另存为 .xlsx 后上传。</p></section>
   </div><p className="mt-3 border-t border-indigo-100 pt-3 text-xs">工具栏若被折叠，双击“开始 / 插入”等选项卡展开。原生编辑器的保存提示与上方服务器版本号分别核对。</p>
  </details>
  <div data-office-ready={ready} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{height:'76vh',minHeight:600}}><div id="office-editor"/></div>
  <details id="office-history" className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-medium">已保存版本与恢复候选</summary>{state?.versions?.filter((v:any)=>v.revision||state.role==='OWNER').map((v:any)=><div key={v.id} data-office-version={v.id} className="flex items-center gap-3"><button onClick={()=>download(v.id)} className="block p-2 underline">{v.revision?'版本 '+v.revision:'隔离恢复候选（未合并）'} · {displayDate(v.created_at)}</button>{['OWNER','EDITOR'].includes(state.role)&&<button className="border px-2 py-1 rounded" onClick={async()=>{try{const requestId=restoreIds.current[v.id]||(restoreIds.current[v.id]=crypto.randomUUID());const r=await api.post(base+'/restore',{versionId:v.id,requestId});router.push('/office/'+r.data.id)}catch{setMessage('恢复副本失败，请检查权限后重试；原文件不受影响。')}}}>恢复为私有副本</button>}</div>)}</details>
  {state?.role==='OWNER'&&<section id="office-access" className="border rounded p-3"><h2>文件访问权限</h2><div className="flex gap-2"><select aria-label="Office 授权成员" value={target} onChange={e=>setTarget(e.target.value)}><option value="">选择成员</option>{members.map((m:any)=><option key={m.id} value={m.userId}>{m.user.name}</option>)}</select><select aria-label="Office 成员权限" value={role} onChange={e=>setRole(e.target.value)}><option value="EDITOR">编辑</option><option value="VIEWER">只读</option><option value="REMOVE">撤销访问</option></select><button disabled={!target} onClick={async()=>{try{await api.put('/documents/'+params.id+'/grants',{userId:target,role});setGrants((await api.get('/documents/'+params.id+'/grants')).data);setMessage('权限已更新，活动会话会重新校验。')}catch{setMessage('权限更新失败。')}}}>更新权限</button></div>{grants.map(g=><p key={g.user_id}>{g.name} · {g.role}</p>)}<p className="text-xs text-slate-500">同组织成员还需具备所属项目访问权；权限失效会冻结会话，阻止旧会话覆盖保存结果。</p></section>}
 </main>;
}
