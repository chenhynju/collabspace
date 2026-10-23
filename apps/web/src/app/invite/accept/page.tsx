'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Building2,ShieldCheck} from 'lucide-react';
import {Card,Button,Badge} from '@/components/ui';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';
const labels:Record<string,string>={PENDING:'待接受',ACCEPTED:'已接受',DECLINED:'已拒绝',REVOKED:'已撤销',EXPIRED:'已过期'};
export default function InviteAcceptPage(){
 const [token,setToken]=useState(''),[id,setId]=useState(''),[preview,setPreview]=useState<any>(null),[error,setError]=useState(''),[done,setDone]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const authToken=useAuthStore(s=>s.token),user=useAuthStore(s=>s.user);
 useEffect(()=>{const p=new URLSearchParams(location.search),t=p.get('token')||'',i=p.get('id')||'';setToken(t);setId(i);let active=true;setError('');setPreview(null);
 if(!t&&!i){setError('邀请链接缺少凭证');setLoaded(true);return;}
 if(!t&&!authToken){setLoaded(true);return;}
 const load=async()=>{try{if(authToken)await useAuthStore.getState().loadProfile();const r=t?await api.get('/invitations/preview',{params:{token:t}}):await api.get(`/invitations/${encodeURIComponent(i)}/details`);if(active)setPreview(r.data);}catch(e:any){if(active)setError(e.response?.data?.message||'邀请不可用');}finally{if(active)setLoaded(true);}};load();return()=>{active=false;};},[authToken]);
 const respond=async(accept:boolean)=>{setBusy(true);setError('');try{const action=accept?'accept':'decline';const {data}=await api.post(token?`/invitations/${action}`:`/invitations/${encodeURIComponent(id)}/${action}`,token?{token}:{});if(accept){await useAuthStore.getState().loadProfile();await useAuthStore.getState().setCurrentOrg(data.organizationId);}setDone(accept?'已成功加入组织':'已拒绝邀请，你仍可使用自己的空间');setPreview((p:any)=>({...p,status:accept?'ACCEPTED':'DECLINED'}));}catch(e:any){setError(e.response?.data?.message||'处理失败，请重试');}finally{setBusy(false);}};
 const next='/invite/accept?'+(token?'token='+encodeURIComponent(token):'id='+encodeURIComponent(id));
 const mismatch=!!authToken&&!!user&&!!preview&&user.email.toLowerCase()!==preview.email.toLowerCase();
 return <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc] p-5"><Card className="w-full max-w-lg p-8"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Building2 size={24}/></div><p className="text-xs font-semibold tracking-widest text-indigo-500">COLLABSPACE</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">组织协作邀请</h1><p className="mt-2 text-sm leading-6 text-slate-500">加入前请核对组织与角色。只有你明确接受后，组织成员关系才会生效。</p>
 {preview&&<div className="my-6 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm"><Row label="组织" value={preview.organization?.name||'组织不可用'}/><Row label="邀请人" value={preview.inviter?.name||'组织管理员'}/><Row label="角色" value={preview.role?.name||'角色不可用'}/><Row label="受邀邮箱" value={preview.email}/><Row label="有效期至" value={new Date(preview.expiresAt).toISOString().slice(0,10)}/><Badge tone={preview.status==='PENDING'?'blue':'slate'}>{labels[preview.status]||preview.status}</Badge></div>}
 {!loaded&&<p className="py-5 text-sm text-slate-400">正在加载邀请…</p>}{error&&<p role="alert" className="my-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}{authToken&&user&&error.includes('验证受邀邮箱')&&<Link href={'/check-email?email='+encodeURIComponent(user.email)} className="my-3 block text-sm font-medium text-indigo-600">验证受邀邮箱后再处理 →</Link>}{mismatch&&<p className="my-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">当前账号与受邀邮箱不一致，请退出后使用受邀邮箱登录。</p>}
 {done?<div className="space-y-4"><p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{done}</p><Link href="/notifications" className="text-sm font-medium text-indigo-600">进入通知中心 →</Link></div>:authToken?<div className="mt-5 flex gap-3"><Button className="flex-1" disabled={busy||mismatch||preview?.status!=='PENDING'} onClick={()=>respond(true)}>接受邀请并加入</Button><Button variant="secondary" disabled={busy||mismatch||preview?.status!=='PENDING'} onClick={()=>respond(false)}>拒绝邀请</Button></div>:<div className="mt-6 flex flex-wrap gap-3"><Link href={'/login?next='+encodeURIComponent(next)}><Button>登录后处理</Button></Link>{token&&preview?.status==='PENDING'&&<Link href={'/register?invitation='+encodeURIComponent(token)}><Button variant="secondary">注册受邀邮箱</Button></Link>}</div>}
 <p className="mt-6 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={14}/>组织数据按权限隔离，加入不会公开你的个人内容。</p></Card></div>;
}
function Row({label,value}:{label:string;value:string}){return <div className="flex flex-wrap justify-between gap-2"><span className="text-slate-400">{label}</span><span className="break-all text-slate-700">{value}</span></div>;}
