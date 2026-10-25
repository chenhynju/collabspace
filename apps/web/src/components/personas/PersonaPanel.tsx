'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {Button,inputCls} from '@/components/ui';
import {Disclosure} from '@/components/disclosure';
import {FilePicker} from '@/components/file-picker';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';
const AvatarPreview=dynamic(()=>import('./AvatarPreview'),{ssr:false});
export function PersonaPanel({active=true}:{active?:boolean}){
 const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id);
 return <PersonaSession key={`${org}:${user}`} active={active}/>;
}
function PersonaSession({active}:{active:boolean}){
 const [open,setOpen]=useState(false),[language,setLanguage]=useState('zh-CN'),[notice,setNotice]=useState(''),[model,setModel]=useState(''),[speaking,setSpeaking]=useState(false);
 const edited=useRef(false),savedStyle=useRef('cartoon');
 useEffect(()=>{const c=new AbortController();void api.get('/voice/persona',{signal:c.signal}).then(r=>{if(!c.signal.aborted){savedStyle.current=r.data.style;if(!edited.current)setLanguage(r.data.locale);}}).catch(()=>{});return()=>c.abort();},[]);
 useEffect(()=>()=>{if(model)URL.revokeObjectURL(model);},[model]);
 useEffect(()=>{if(!active)setSpeaking(false);},[active]);
 const save=async()=>{try{await api.put('/voice/persona',{style:savedStyle.current,locale:language});setNotice('已保存当前组织的个人偏好；不会改变身份或权限');}catch{setNotice('保存失败，请检查数据库迁移或网络');}};
 return <Disclosure title="我的数字形象" open={open} onOpenChange={value=>{setOpen(value);if(!value)setSpeaking(false);}} unmountOnClose className="rounded-xl border bg-white p-4">{open&&<div className="mt-3 space-y-3">
  <p className="text-xs text-slate-500">本人形象 · 3D卡通</p>
  <div className="flex flex-wrap gap-3"><label>默认语言 <select className={inputCls+' mt-1'} aria-label="形象默认语言" value={language} onChange={e=>{edited.current=true;setLanguage(e.target.value);}}><option value="zh-CN">中文</option><option value="en-US">English</option></select></label><Button variant="secondary" size="sm" type="button" onClick={()=>void save()}>保存形象偏好</Button></div>
  <><AvatarPreview active={active&&open} speaking={speaking} vrmUrl={model||undefined}/><p className="text-xs">内置原创几何人物；可本地预览你有使用权的VRM模型，文件不上传。云语音播放时按音量驱动嘴部，不是精确嘴型。</p><FilePicker label="预览VRM模型" accept=".vrm" hint="本地预览，最大10MB" onFile={f=>{if(f.size>10*1024*1024){setNotice('模型最大10MB');return;}setModel(URL.createObjectURL(f));}}/><Button variant="secondary" size="sm" type="button" onClick={()=>setSpeaking(!speaking)}>{speaking?'停止动作预览':'预览讲话动作（无音频）'}</Button></>
  {notice&&<p role="status">{notice}</p>}
 </div>}</Disclosure>;
}
