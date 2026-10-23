'use client';
import {useCallback,useState} from 'react';
import Link from 'next/link';
import {Bell,CheckCheck,ArrowUpRight} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import {Card,Button,Empty,InlineError} from '@/components/ui';
import {api} from '@/lib/api';
import {usePersonalNotifications} from '@/lib/use-personal-notifications';
import {useAuthStore} from '@/store/auth';
const status:Record<string,string>={PENDING:'待处理',ACCEPTED:'已接受',DECLINED:'已拒绝',REVOKED:'已撤销',EXPIRED:'已过期'};
export default function NotificationsPage(){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState('');
 const load=useCallback(()=>{const token=useAuthStore.getState().token;api.get('/notifications').then(({data})=>{if(useAuthStore.getState().token===token){setRows(data);setError('');}}).catch(()=>setError('通知加载失败，请稍后重试'));},[]);
 const {count,refresh}=usePersonalNotifications(load);
 const read=async(id:string)=>{try{await api.post(`/notifications/${id}/read`);load();refresh();window.dispatchEvent(new Event('personal-notifications:refresh'));}catch{setError('未能标记已读，请重试');}};
 return <div className="mx-auto max-w-5xl p-5 md:p-8"><PageHeader title="通知中心" description="属于你的邀请与处理结果，切换组织后仍可查看。"><span className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700">{count} 条未读</span></PageHeader>
 <InlineError message={error}/>{!rows.length?<Empty text="暂无通知，收到组织邀请后会显示在这里"/>:<div className="space-y-3">{rows.map(n=><Card key={n.id} className="flex gap-4 p-5"><div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${n.read_at?'bg-slate-100 text-slate-400':'bg-indigo-50 text-indigo-600'}`}><Bell size={18}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-800">{n.title}</h2>{!n.read_at&&<span className="h-2 w-2 rounded-full bg-indigo-500"/>}<span className="text-xs text-slate-400">{new Date(n.created_at).toISOString().replace('T',' ').slice(0,16)} UTC</span></div><p className="mt-1 break-words text-sm leading-6 text-slate-500">{n.body}</p><div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-xs text-slate-500">{status[n.invitation_status==='PENDING'&&new Date(n.expires_at)<new Date()?'EXPIRED':n.invitation_status]}</span>{n.event==='RECEIVED'&&<Link href={`/invite/accept?id=${encodeURIComponent(n.invitation_id)}`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600">查看邀请<ArrowUpRight size={14}/></Link>}{!n.read_at&&<Button variant="ghost" size="sm" onClick={()=>read(n.id)}><CheckCheck size={14}/>标记已读</Button>}</div></div></Card>)}</div>}</div>;
}
