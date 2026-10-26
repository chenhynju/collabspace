"use client";
import {useEffect,useRef,useState} from 'react';
import {Button,inputCls} from '@/components/ui';
import {Disclosure} from '@/components/disclosure';
import {FilePicker} from '@/components/file-picker';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';

type Draft={id:string;kind:'PHOTO'|'VIDEO';state:string;createdAt:string;expiresAt:string};
export function PersonaPanel({active=true}:{active?:boolean}){
 const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id);
 return <EmployeePersona key={`${org}:${user}`} active={active}/>;
}
function EmployeePersona({active}:{active:boolean}){
 const [open,setOpen]=useState(false),[language,setLanguage]=useState('zh-CN'),[notice,setNotice]=useState(''),[kind,setKind]=useState<'PHOTO'|'VIDEO'>('PHOTO'),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[caps,setCaps]=useState<any>(null),[drafts,setDrafts]=useState<Draft[]>([]),[mediaKind,setMediaKind]=useState<'PHOTO'|'VIDEO'>('PHOTO');
 const pending=useRef<string|null>(null),epoch=useRef(0),controller=useRef<AbortController|null>(null);
 const clearPreview=()=>{setPreview('');setFile(null);setConsent(false);pending.current=null;};
 useEffect(()=>{if(!preview)return;return()=>URL.revokeObjectURL(preview);},[preview]);
 useEffect(()=>()=>{epoch.current++;controller.current?.abort();},[]);
 useEffect(()=>{if(!active){epoch.current++;controller.current?.abort();setOpen(false);clearPreview();setBusy(false);}},[active]); // eslint-disable-line react-hooks/exhaustive-deps
 const load=async(signal:AbortSignal)=>{const [c,p,d]=await Promise.all([api.get('/voice/persona/capabilities',{signal}),api.get('/voice/persona',{signal}),api.get('/voice/persona/drafts',{signal})]);if(signal.aborted)return;setCaps(c.data);setLanguage(p.data.locale);setDrafts(d.data);};
 useEffect(()=>{if(!open||!active)return;const c=new AbortController();void load(c.signal).catch(()=>{if(!c.signal.aborted)setNotice('数字分身服务未就绪；请检查服务版本、迁移或网络。');});return()=>c.abort();},[open,active]); // eslint-disable-line react-hooks/exhaustive-deps
 const action=async(work:(signal:AbortSignal,n:number)=>Promise<void>)=>{if(busy)return;const c=new AbortController();controller.current=c;const n=++epoch.current;setBusy(true);setNotice('');try{await work(c.signal,n);}catch(e:any){if(!c.signal.aborted&&n===epoch.current)setNotice(typeof e.response?.data?.message==='string'?e.response.data.message:'操作失败，请检查网络后重试。');}finally{if(n===epoch.current)setBusy(false);}};
 const choose=(f:File)=>{clearPreview();if(f.size>20971520){setNotice('素材最大20MB');return;}if(!(kind==='PHOTO'?['image/png','image/jpeg','image/webp']:['video/mp4','video/webm']).includes(f.type)){setNotice('请选择当前类型支持的真实文件');return;}setMediaKind(kind);setFile(f);setPreview(URL.createObjectURL(f));setNotice('仅本地预览，尚未上传或生成数字分身。');};
 return <Disclosure title="我的数字分身" open={open} onOpenChange={v=>{setOpen(v);if(!v){epoch.current++;controller.current?.abort();clearPreview();setBusy(false);}}} unmountOnClose className="rounded-xl border bg-white p-3">{open&&<div className="mt-3 space-y-3 text-sm">
  <p className="text-xs text-slate-500">真人同事 · 本人照片或视频。卡通角色属于AI Agent，不会代替你的真实身份。</p>
  <div className="flex flex-wrap items-end gap-2"><label>默认语言<select aria-label="形象默认语言" className={inputCls+' mt-1'} value={language} disabled={busy} onChange={e=>{pending.current=null;setLanguage(e.target.value);}}><option value="zh-CN">中文</option><option value="en-US">English</option></select></label><Button variant="secondary" size="sm" disabled={busy} onClick={()=>void action(async(signal,n)=>{await api.put('/voice/persona',{style:'realistic',locale:language},{signal});if(n===epoch.current)setNotice('已保存当前组织的个人语言偏好；不会改变身份或权限。');})}>保存形象偏好</Button></div>
  <fieldset disabled={busy} className="flex gap-3"><legend className="mb-1 font-medium">1. 选择素材路径</legend>{(['PHOTO','VIDEO'] as const).map(k=><label key={k}><input type="radio" name="employee-source-kind" value={k} checked={kind===k} onChange={()=>{setKind(k);clearPreview();}}/> {k==='PHOTO'?'照片生成':'视频创建'}</label>)}</fieldset>
  <p className="text-xs text-slate-500">{kind==='PHOTO'?'上传清晰单人正脸照片，避免遮挡和强滤镜；仅支持PNG/JPEG/WebP。':'上传本人MP4/WebM素材。录制时长、台词和授权视频要求待供应商确认；保存草稿不代表素材已满足训练要求。'}</p>
  <FilePicker disabled={busy} key={kind} label={kind==='PHOTO'?'选择本人照片':'选择本人视频'} accept={kind==='PHOTO'?'.png,.jpg,.jpeg,.webp':'.mp4,.webm'} hint="仅本人素材 · 最大20MB · 先在本地预览" onFile={choose}/>
  {preview&&<div className="max-w-xs">{mediaKind==='PHOTO'?<img src={preview} alt="本人素材预览，尚非生成结果" className="max-h-64 rounded-xl object-contain"/>:<video src={preview} aria-label="本人视频素材预览" controls preload="metadata" className="max-h-64 rounded-xl"/>}<p className="mt-1 text-xs text-slate-500">原始素材预览 · 不是AI生成结果</p></div>}
  <label className="flex items-start gap-2 text-xs"><input aria-label="本人素材草稿授权" type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>2. 我确认是本人素材，授权在本组织中私有保存本次草稿（最长7天）。不包含外部供应商训练、声音克隆或自动发送授权。{caps&&<span className="text-slate-400"> 授权版本：{caps.consentVersion}</span>}</span></label>
  <div className="flex gap-2"><Button variant="secondary" size="sm" disabled={busy||!file||!consent||!caps} onClick={()=>void action(async(signal,n)=>{const form=new FormData();if(!file)return;if(!pending.current)pending.current=crypto.randomUUID();Object.entries({requestId:pending.current,kind,locale:language,consent:'true',consentVersion:caps.consentVersion}).forEach(([k,v])=>form.append(k,v));form.append('file',file);await api.post('/voice/persona/drafts',form,{signal});if(n===epoch.current){clearPreview();setDrafts((await api.get('/voice/persona/drafts',{signal})).data);setNotice('已保存私有素材草稿，尚未创建或训练数字分身。');}})}>保存私有素材草稿</Button>{preview&&<Button variant="secondary" size="sm" disabled={busy} onClick={clearPreview}>清除本地预览</Button>}</div>
  <p role="status" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{caps?.creation?.reason||'正在检查数字分身服务…'}照片与视频真实生成均待供应商接入；不会显示虚假的创建成功或可播放结果。</p>
  <div className="space-y-2"><div className="flex items-center gap-2"><strong className="text-xs">我的私有素材草稿</strong><Button size="sm" variant="secondary" disabled={busy} onClick={()=>void action(async(signal,n)=>{const r=await api.get('/voice/persona/drafts',{signal});if(n===epoch.current)setDrafts(r.data);})}>刷新草稿</Button></div>{drafts.map(d=><div key={d.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs"><span>{d.kind==='PHOTO'?'照片':'视频'} · {d.state==='REVOKED'?'已撤销，原素材已删除':'草稿，未生成'}</span>{d.state==='DRAFT'&&<><Button size="sm" variant="secondary" disabled={busy} onClick={()=>void action(async(signal,n)=>{const r=await api.get(`/voice/persona/drafts/${d.id}/source`,{responseType:'blob',signal});if(n!==epoch.current)return;setMediaKind(d.kind);setFile(null);setConsent(false);setPreview(URL.createObjectURL(r.data));})}>查看原素材</Button><Button size="sm" variant="secondary" disabled={busy} onClick={()=>void action(async(signal,n)=>{await api.delete(`/voice/persona/drafts/${d.id}`,{signal});if(n===epoch.current){clearPreview();setDrafts((await api.get('/voice/persona/drafts',{signal})).data);setNotice('已撤销该草稿，原素材已从当前存储删除。');}})}>撤销并删除素材</Button></>}</div>)}</div>
  {notice&&<p role="status" className="text-xs">{notice}</p>}
 </div>}</Disclosure>;
}
