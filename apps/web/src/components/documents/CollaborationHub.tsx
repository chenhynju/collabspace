"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FileText,FileCode2,Network,FileSpreadsheet,Presentation,Upload,Search,ArrowUpRight,Plus,FolderOpen} from 'lucide-react';
import {api} from '@/lib/api';
import {useAuthStore} from '@/store/auth';
import {Button,Card,Input,Modal,Select,Field,Empty} from '@/components/ui';
import {displayDate} from '@/lib/display-date';

const types=[
 {id:'DOCUMENT',name:'富文本文档',hint:'图文、表格与数学公式',icon:FileText,color:'bg-indigo-50 text-indigo-600'},
 {id:'MARKDOWN',name:'Markdown',hint:'源码与预览实时协作',icon:FileCode2,color:'bg-slate-100 text-slate-600'},
 {id:'BOARD',name:'白板 / Mermaid',hint:'流程、架构与思维导图',icon:Network,color:'bg-violet-50 text-violet-600'},
 {id:'DOCX',name:'Word',hint:'文字、图片与排版',icon:FileText,color:'bg-blue-50 text-blue-600'},
 {id:'XLSX',name:'Excel',hint:'工作表、函数与数据',icon:FileSpreadsheet,color:'bg-emerald-50 text-emerald-600'},
 {id:'PPTX',name:'PowerPoint',hint:'幻灯片、形状与图片',icon:Presentation,color:'bg-orange-50 text-orange-600'},
];
type Resource={id:string;title:string;kind:string;project:string;projectId:string;date:string;editor?:string;role?:string;href:string;fileId?:string};
const officeKind=(name:string)=>name.split('.').pop()?.toUpperCase()||'DOCX';
const roleLabel=(role?:string)=>(({OWNER:'所有者',EDITOR:'可编辑',COMMENTER:'可评论',VIEWER:'只读'} as Record<string,string>)[role||'']||role||'—');
const message=(e:any)=>(({OFFICE_NOT_CONFIGURED:'Office 服务暂不可用，请稍后重试。',UPLOADER_REQUIRED:'请上传者先开启此文件的在线编辑，再向你授权。',OFFICE_CREATE_CONFLICT:'该创建请求与已有内容不同，请关闭窗口后重新创建。',READ_ONLY:'你对该项目只有只读权限。',PROJECT_ARCHIVED:'项目已归档，不能新建内容。'} as Record<string,string>)[e.response?.data?.code||'']||e.response?.data?.message||e.message||'操作失败，请检查权限或网络。');

type HubProps={projectId?:string;initialKind?:string};
export default function CollaborationHub(props:HubProps){const scope=useAuthStore(s=>s.currentOrgId);return <HubContent key={scope+':'+props.projectId+':'+props.initialKind} {...props}/>;}
function HubContent({projectId='',initialKind='ALL'}:HubProps){
 const router=useRouter(),org=useAuthStore(s=>s.currentOrgId),orgs=useAuthStore(s=>s.organizations),me=useAuthStore(s=>s.user),hasPerm=useAuthStore(s=>s.hasPerm);
 const[projects,setProjects]=useState<any[]>([]),[resources,setResources]=useState<Resource[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState(initialKind),[projectFilter,setProjectFilter]=useState(projectId),[reload,setReload]=useState(0);
 const[create,setCreate]=useState(''),[project,setProject]=useState(''),[title,setTitle]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[createError,setCreateError]=useState('');
 const requestId=useRef(''),uploaded=useRef<{file:File;org:string|null;project:string;id:string}|null>(null);
 useEffect(()=>{setFilter(initialKind);setProjectFilter(projectId);setCreate('');},[org,projectId,initialKind]);
 useEffect(()=>{let active=true;const abort=new AbortController(),headers={'x-organization-id':org},options={headers,signal:abort.signal};setResources([]);setProjects([]);setLoading(true);setError('');
 (async()=>{try{
  const r=await api.get('/projects',options),list=Array.isArray(r.data)?r.data:r.data.list||[];if(!active)return;setProjects(list);
  const selected=projectId?list.filter((p:any)=>p.id===projectId):list,docs:Resource[]=[];let failed=false;
  if(projectId&&!selected.length){setError('项目不存在或没有访问权限。');return;}
  for(let i=0;i<selected.length;i+=4){const results=await Promise.allSettled(selected.slice(i,i+4).map(async(p:any)=>{
   const rows:any[]=[],seen=new Set<string>();for(let offset=0;;offset+=100){const d=await api.get('/documents',{...options,params:{projectId:p.id,offset,limit:100}});const fresh=d.data.filter((v:any)=>!seen.has(v.id));if(!fresh.length)break;for(const v of fresh){seen.add(v.id);rows.push(v);}if(d.data.length<100)break;}
   return rows.map((v:any)=>({id:v.id,title:v.title,kind:v.kind==='OFFICE'?officeKind(v.title):v.kind,project:p.name,projectId:p.id,date:v.updated_at,editor:v.last_editor,role:v.role,href:v.kind==='OFFICE'?'/office/'+v.id:'/projects/'+p.id+'/documents/'+v.id}));
  }));if(!active)return;for(const result of results){if(result.status==='fulfilled')docs.push(...result.value);else failed=true;}}
  const merged=new Map(docs.map(d=>[d.id,d]));
  if(hasPerm('file:manage'))try{
   const f=await api.get('/files',{...options,params:projectId?{projectId}:undefined});
   for(const v of f.data.filter((v:any)=>/\.(docx|xlsx|pptx)$/i.test(v.name))){
    const id=v.officeId||'file:'+v.id,old=merged.get(id);
    merged.set(id,{id,title:old?.title||v.name,kind:officeKind(v.name),project:v.project?.name||'项目文件',projectId:v.projectId,date:v.lastEditedAt||old?.date||v.createdAt,editor:v.lastEditor?.name||old?.editor||(v.officeRevision>1?undefined:v.uploadedBy?.name),role:old?.role||(v.officeId?'权限待确认':v.uploadedBy?.id===me?.id?'待开启协作':'请上传者开启'),href:v.officeId?'/office/'+v.officeId:'',fileId:v.officeId?undefined:v.id});
   }
  }catch{failed=true;}
  if(active){setResources([...merged.values()].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()));if(failed)setError('部分资源加载失败，可重新加载；当前只显示已成功加载且有权访问的内容。');}
 }catch{if(active)setError('协作内容加载失败，请检查网络或权限后重试。');}finally{if(active)setLoading(false);}})();
 return()=>{active=false;abort.abort();};},[org,reload,projectId,hasPerm,me?.id]);
 const visible=resources.filter(d=>(!projectFilter||d.projectId===projectFilter)&&(filter==='ALL'||filter==='DOCUMENTS'&&['DOCUMENT','MARKDOWN'].includes(d.kind)||d.kind===filter)&&(d.title+' '+d.project).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const start=(kind:string)=>{setCreate(kind);setProject(projectId||projectFilter||projects[0]?.id||'');setTitle('');setFile(null);setCreateError('');requestId.current='';uploaded.current=null;};
 const navigate=(href:string,scope:string|null)=>{if(useAuthStore.getState().currentOrgId===scope)router.push(href);};
 const open=async(d:Resource)=>{if(d.href)return router.push(d.href);const scope=org;try{const r=await api.post('/office/files/'+d.fileId+'/open',{}, {headers:{'x-organization-id':scope}});navigate('/office/'+r.data.id,scope);}catch(e){if(useAuthStore.getState().currentOrgId===scope)setError(message(e));}};
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setCreateError('');const scope=org,headers={'x-organization-id':scope};try{
  if(create==='IMPORT'){
   if(!file)throw Error('请选择文件。');if(file.size>20*1024*1024)throw Error('文件不能超过20MB。');
   if(/\.(md|mmd|mermaid)$/i.test(file.name)){
    const markdown=/\.md$/i.test(file.name),max=markdown?64000:32000;
    if(file.size>200000)throw Error('源码文件不能超过200KB。');const source=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()).replace(/\r\n?/g,'\n');
    if(source.length>max||source.includes('\0'))throw Error('源码过长或包含二进制内容。');
    const r=await api.post('/documents',{projectId:project,title:file.name.slice(0,160),kind:markdown?'MARKDOWN':'BOARD',source},{headers});navigate('/projects/'+project+'/documents/'+r.data.id,scope);
   }else{
    if(!hasPerm('file:manage'))throw Error('当前账号没有附件上传权限，可导入 Markdown 或 Mermaid 源码。');
    let id=uploaded.current?.file===file&&uploaded.current.org===scope&&uploaded.current.project===project?uploaded.current.id:'';
    if(!id){const form=new FormData();form.append('file',file);form.append('projectId',project);const r=await api.post('/files/upload',form,{headers});id=r.data.id;uploaded.current={file,org:scope,project,id};}
    if(/\.(docx|xlsx|pptx)$/i.test(file.name)){const r=await api.post('/office/files/'+id+'/open',{}, {headers});navigate('/office/'+r.data.id,scope);}else navigate('/files',scope);
   }
  }else if(['DOCX','XLSX','PPTX'].includes(create)){
   requestId.current ||= crypto.randomUUID();const r=await api.post('/office/create',{projectId:project,title,extension:create.toLowerCase(),requestId:requestId.current},{headers});navigate('/office/'+r.data.id,scope);
  }else{const r=await api.post('/documents',{projectId:project,title,kind:create},{headers});navigate('/projects/'+project+'/documents/'+r.data.id,scope);}
 }catch(e){if(useAuthStore.getState().currentOrgId===scope)setCreateError(message(e));}finally{setBusy(false);}}
 const scopedProject=projects.find(p=>p.id===projectId);
 return <main className="mx-auto max-w-[1440px] space-y-6 p-5 sm:p-8">
  <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs text-slate-500">{orgs.find(o=>o.id===org)?.name} / {scopedProject?.name||'团队创作'}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">协作空间</h1><p className="mt-2 text-sm text-slate-500">文档、图表与 Office，同一个入口创建和继续编辑。</p></div><div className="flex gap-2">{projectId&&<Link href={'/projects/'+projectId} className="self-center px-3 text-sm text-slate-500">项目详情</Link>}<Button variant="secondary" onClick={()=>start('IMPORT')}><Upload size={16}/> 上传文件</Button><Button onClick={()=>start('DOCUMENT')}><Plus size={16}/> 新建</Button></div></header>
  <section aria-label="新建协作内容" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{types.map(t=><button key={t.id} aria-label={'新建 '+t.name} disabled={['DOCX','XLSX','PPTX'].includes(t.id)&&!hasPerm('file:manage')} onClick={()=>start(t.id)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"><span className={'inline-flex rounded-xl p-2 '+t.color}><t.icon size={20}/></span><h2 className="mt-3 text-sm font-semibold">{t.name}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t.hint}</p></button>)}</section>
  <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-semibold">{scopedProject?.name||'全部协作内容'}</h2><p className="mt-1 text-xs text-slate-500">最近编辑优先 · 仅显示你可访问的内容</p></div><div className="flex flex-wrap gap-2"><label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><Input aria-label="搜索协作资源" placeholder="搜索名称或项目" className="pl-9" value={query} onChange={e=>setQuery(e.target.value)}/></label><Button variant="ghost" onClick={()=>setReload(x=>x+1)} disabled={loading}>重新加载</Button></div></div>
   <div className="flex flex-wrap gap-3 px-5 py-4"><Select className="!w-auto min-w-[160px]" aria-label="内容类型" value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">全部类型</option>{filter==='DOCUMENTS'&&<option value="DOCUMENTS">文档与 Markdown</option>}{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select><Select className="!w-auto min-w-[160px]" aria-label="筛选所属项目" value={projectFilter} disabled={!!projectId} onChange={e=>setProjectFilter(e.target.value)}><option value="">全部项目</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select><span className="ml-auto self-center text-xs text-slate-400">{visible.length} 项</span></div>
   {error&&<p role="alert" className="mx-5 mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
   {loading?<p role="status" className="p-10 text-center text-sm text-slate-500">正在加载协作内容…</p>:!visible.length?<div className="p-6"><Empty text={query?'没有匹配的内容。':'暂无可访问内容，从上方选择类型开始创作。'}/></div>:<div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['名称','类型','所属项目','最近编辑人','编辑时间','权限'].map(h=><th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map(d=>{const t=types.find(t=>t.id===d.kind)||types[0];return <tr key={d.id} className="hover:bg-indigo-50/30"><td className="px-5 py-4"><span className="contents">{d.href?<Link href={d.href} className="flex w-full items-center gap-3 text-left font-medium"><span className={'rounded-lg p-2 '+t.color}><t.icon size={18}/></span><span className="max-w-[340px] truncate">{d.title}</span><ArrowUpRight size={14} className="shrink-0 text-slate-400"/></Link>:<button onClick={()=>void open(d)} className="flex w-full items-center gap-3 text-left font-medium"><span className={'rounded-lg p-2 '+t.color}><t.icon size={18}/></span><span className="max-w-[340px] truncate">{d.title}</span><ArrowUpRight size={14} className="shrink-0 text-slate-400"/></button>}</span></td><td className="px-5 py-4 text-slate-500">{t.name}</td><td className="px-5 py-4 text-slate-500">{d.project}</td><td className="px-5 py-4 text-slate-500">{d.editor||'历史作者未记录'}</td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{displayDate(d.date)}</td><td className="px-5 py-4"><span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{roleLabel(d.role)}</span></td></tr>;})}</tbody></table></div>}
  </Card>
  {!projectId&&<section><h2 className="mb-3 text-sm font-semibold text-slate-700">按项目进入</h2><div className="grid gap-3 md:grid-cols-3">{projects.map(p=><Link key={p.id} href={'/projects/'+p.id+'/content'} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm hover:border-indigo-300"><span className="flex items-center gap-2"><FolderOpen size={17} className="text-indigo-500"/>{p.name}</span><ArrowUpRight size={15}/></Link>)}</div></section>}
  <Modal open={!!create} onClose={()=>!busy&&setCreate('')} title={create==='IMPORT'?'上传已有文件':'新建协作内容'}><form className="space-y-4" onSubmit={submit}>
   {create!=='IMPORT'&&<Field label="内容类型"><Select aria-label="新建内容类型" value={create} disabled={busy} onChange={e=>{setCreate(e.target.value);requestId.current='';setCreateError('');}}>{types.map(t=><option key={t.id} value={t.id} disabled={['DOCX','XLSX','PPTX'].includes(t.id)&&!hasPerm('file:manage')}>{t.name}</option>)}</Select></Field>}
   <Field label="所属项目"><Select aria-label="所属项目" required value={project} disabled={busy||!!projectId} onChange={e=>{setProject(e.target.value);requestId.current='';}}><option value="">选择项目</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
   {create==='IMPORT'?<Field label="选择文件"><input aria-label="上传已有文件" type="file" accept={hasPerm('file:manage')?undefined:'.md,.mmd,.mermaid'} required disabled={busy} onChange={e=>{setFile(e.target.files?.[0]||null);uploaded.current=null;}}/><p className="mt-2 text-xs leading-5 text-slate-500">Markdown、Mermaid 和 Office 上传后进入对应编辑器；其他文件进入附件管理。最大20MB，源码文件最大200KB。</p></Field>:<Field label="名称"><Input aria-label="新内容标题" required maxLength={150} value={title} disabled={busy} onChange={e=>{setTitle(e.target.value);requestId.current='';}}/>{['DOCX','XLSX','PPTX'].includes(create)&&<p className="mt-2 text-xs text-slate-500">自动创建空白 .{create.toLowerCase()} 文件，打开后即可编辑。</p>}</Field>}
   {!projects.length&&<p className="text-sm text-slate-500">先创建项目，或请负责人授予项目访问权限。</p>}{createError&&<p role="alert" className="text-sm text-red-700">{createError}</p>}<Button disabled={busy||!project}>{busy?'正在处理…':create==='IMPORT'?'上传并打开':'创建并打开'}</Button>
  </form></Modal>
 </main>;
}
