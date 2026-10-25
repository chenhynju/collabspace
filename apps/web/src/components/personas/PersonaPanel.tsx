'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';
const AvatarPreview=dynamic(()=>import('./AvatarPreview'),{ssr:false});
export function PersonaPanel({active=true}:{active?:boolean}){
 const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id);
 return <PersonaSession key={`${org}:${user}`} active={active}/>;
}
function PersonaSession({active}:{active:boolean}){
 const [open,setOpen]=useState(false),[style,setStyle]=useState('cartoon'),[language,setLanguage]=useState('zh-CN'),[notice,setNotice]=useState(''),[model,setModel]=useState(''),[speaking,setSpeaking]=useState(false);
 const edited=useRef(false);
 useEffect(()=>{const c=new AbortController();void api.get('/voice/persona',{signal:c.signal}).then(r=>{if(!c.signal.aborted&&!edited.current){setStyle(r.data.style);setLanguage(r.data.locale);}}).catch(()=>{});return()=>c.abort();},[]);
 useEffect(()=>()=>{if(model)URL.revokeObjectURL(model);},[model]);
 useEffect(()=>{if(!active)setSpeaking(false);},[active]);
 const save=async()=>{try{await api.put('/voice/persona',{style,locale:language});setNotice('已保存当前组织的个人偏好；不会改变身份或权限');}catch{setNotice('保存失败，请检查数据库迁移或网络');}};
 return <details open={open} onToggle={e=>setOpen(e.currentTarget.open)} className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">我的数字形象</summary>{open&&<div className="mt-3 space-y-3">
  <p className="text-xs text-slate-500">本人身份 · 卡通与真人为外观偏好；AI身份由运行时另行声明。</p>
  <div className="flex flex-wrap gap-3"><label>风格 <select aria-label="形象风格" value={style} onChange={e=>{edited.current=true;setStyle(e.target.value);setSpeaking(false);}}><option value="cartoon">3D卡通</option><option value="realistic">真人风格（待配置）</option></select></label><label>默认语言 <select aria-label="形象默认语言" value={language} onChange={e=>{edited.current=true;setLanguage(e.target.value);}}><option value="zh-CN">中文</option><option value="en-US">English</option></select></label><button type="button" onClick={()=>void save()}>保存形象偏好</button></div>
  {style==='cartoon'?<><AvatarPreview active={active&&open} speaking={speaking} vrmUrl={model||undefined}/><p className="text-xs">内置原创几何人物；可本地预览你有使用权的VRM模型，文件不上传。云语音播放时按音量驱动嘴部，不是精确嘴型。</p><label className="block text-xs">预览VRM模型 <input aria-label="预览VRM模型" type="file" accept=".vrm" onChange={e=>{const f=e.target.files?.[0];if(f){if(f.size>10*1024*1024){setNotice('模型最大10MB');return;}setModel(URL.createObjectURL(f));}e.target.value='';}}/></label><button type="button" onClick={()=>setSpeaking(!speaking)}>{speaking?'停止动作预览':'预览讲话动作（无音频）'}</button></>:<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">真人服务尚未配置，当前不能生成真人视频。</p>}
  <p className="text-xs text-slate-500">Agent形象：尚未启用。</p>{notice&&<p role="status">{notice}</p>}
 </div>}</details>;
}
