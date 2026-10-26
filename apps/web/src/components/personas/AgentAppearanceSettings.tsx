'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';
import {Button} from '@/components/ui';
export function AgentAppearanceSettings(){
 const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id);
 return <AppearanceSession key={`${org}:${user}`}/>;
}
function AppearanceSession(){
 const [data,setData]=useState<any>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const c=new AbortController();void api.get('/voice/persona/agent',{signal:c.signal}).then(r=>{if(!c.signal.aborted)setData(r.data);}).catch(()=>{if(!c.signal.aborted)setNotice('Agent形象配置加载失败，请检查API和迁移版本。');});return()=>c.abort();},[]);
 return <section aria-label="后台Agent形象配置" className="mb-4 space-y-3 rounded-xl border bg-white p-4"><h2 className="font-semibold">协作助手的形象</h2><p className="text-xs text-slate-500">配置仅作用于当前组织的AI协作助手，不改变真人同事的头像或权限。</p>{data&&<><div className="flex items-center gap-3"><img src={data.catalog[0].poster} alt="小岚原创形象" className="h-20 w-20 rounded-xl object-cover object-top"/><div><strong>{data.catalog[0].name}</strong><p className="text-xs text-slate-500">固定预设 · 静态外观稿 · 配置版本 {data.revision}</p></div></div><Button size="sm" variant="secondary" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await api.put('/voice/persona/agent',{presetId:'lan-v1',mode:'preset',revision:data.revision});setData({...data,...r.data});setNotice('已保存当前组织的Agent形象配置。');}catch(e:any){setNotice(e.response?.data?.message||'保存失败，请刷新后重试');}finally{setBusy(false);}}}>使用小岚固定形象</Button><p className="text-xs text-amber-800">规划：男款10个、女款10个及捏脸模式。正式模型和可变形绑定尚未完成，当前不能选择或宣称已启用。</p></>}{notice&&<p role="status" className="text-xs">{notice}</p>}</section>;
}
