'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Modal,Button,Card,inputCls } from '@/components/ui';
import {FilePicker} from '@/components/file-picker';
import {assistantTools} from './assistant-tools';
import {Sparkles} from 'lucide-react';

export default function AssistantPanel({initialMode='summary',projectId='',active=true,onProjectChange}:{initialMode?:string;projectId?:string;active?:boolean;onProjectChange?:(id:string)=>void}) {
  const org = useAuthStore(s=>s.currentOrgId);
  const user = useAuthStore(s=>s.user?.id);
  return <AssistantWorkspace key={`${org}:${user}`} org={org} user={user||''} initialMode={initialMode} projectId={projectId} active={active} onProjectChange={onProjectChange} />;
}

function AssistantWorkspace({org,user,initialMode,projectId,active,onProjectChange}:{org:string|null;user:string;initialMode:string;projectId:string;active:boolean;onProjectChange?:(id:string)=>void}) {
  const draftKey=`collabspace:assistant-mail:${user}:${org}`;
  const [projects,setProjects]=useState<{id:string;name:string}[]>([]);
  const [project,setProject]=useState(projectId);
  const [text,setText]=useState('');
  const [mode,setMode]=useState(initialMode);
  const translating=mode==='translate-en'||mode==='translate-zh';
  const [result,setResult]=useState('');
  const [info,setInfo]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [speaking,setSpeaking]=useState(false);
  const [speechAvailable,setSpeechAvailable]=useState(false);
  const [to,setTo]=useState('');
  const [subject,setSubject]=useState('项目沟通');
  const [configured,setConfigured]=useState<boolean|null>(null);
  const [mailReady,setMailReady]=useState(false);
  const [preview,setPreview]=useState<{to:string;subject:string;text:string;projectId:string;requestId:string}|null>(null);
  const [mailBusy,setMailBusy]=useState(false);
  const [history,setHistory]=useState<any[]>([]);
  const mailIntent=useRef<{hash:string;id:string}|null>(null);
  const [mailUncertain,setMailUncertain]=useState(false);
  const alive=useRef(true);
  const generation=useRef(0);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>{
    alive.current=true; const c=new AbortController();
    try{const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');if(saved&&typeof saved.projectId==='string'&&typeof saved.to==='string'&&typeof saved.subject==='string'&&typeof saved.text==='string'&&typeof saved.requestId==='string'){
      setProject(saved.projectId);setTo(saved.to);setSubject(saved.subject);setResult(saved.text);setMode('email');setMailUncertain(true);mailIntent.current={hash:JSON.stringify([saved.projectId,saved.to,saved.subject,saved.text]),id:saved.requestId};setInfo('已恢复待核查发送草稿，请先刷新发送记录，勿重复新建邮件。');
    }}catch{}
    setSpeechAvailable('speechSynthesis' in window);
    void api.get('/projects',{signal:c.signal,headers:{'x-organization-id':org}}).then(r=>{if(alive.current&&!c.signal.aborted)setProjects(r.data);}).catch(()=>{if(alive.current&&!c.signal.aborted)setError('项目加载失败，请检查权限或网络');});
    void api.get('/assistant/status',{signal:c.signal,headers:{'x-organization-id':org}}).then(r=>{if(alive.current){setConfigured(r.data.ai);setMailReady(r.data.mail);}}).catch(()=>{});
    const logout=()=>{window.speechSynthesis?.cancel();setSpeaking(false);for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith(`collabspace:assistant-mail:${user}:`))sessionStorage.removeItem(k);}};
    window.addEventListener('collabspace:logout',logout);
    return ()=>{alive.current=false;c.abort();controller.current?.abort();window.speechSynthesis?.cancel();window.removeEventListener('collabspace:logout',logout);};
  },[org,user,draftKey]);
  const stop=()=>{window.speechSynthesis?.cancel();setSpeaking(false);};
  const reset=()=>{generation.current++;controller.current?.abort();setBusy(false);stop();setResult('');setInfo('');setError('');};
  useEffect(()=>{if(!active){generation.current++;controller.current?.abort();setBusy(false);window.speechSynthesis?.cancel();setSpeaking(false);}},[active]);
  const failure=(e:any)=>setError(typeof e.response?.data?.message==='string'?e.response.data.message:'操作失败，请检查网络后重试');
  const generate=async()=>{
    reset();const n=generation.current;const c=new AbortController();controller.current=c;setBusy(true);
    try {const {data}=await api.post('/assistant/generate',{projectId:project,text:text.slice(0,20000),mode},{signal:c.signal,headers:{'x-organization-id':org}});
      if(!alive.current||generation.current!==n)return;
      setResult(data.text);setInfo(`${data.cached?'复用15分钟内结果，本次未调用模型':'已生成'}${data.truncated?'；仅依据前6000字，不代表全文':''}${data.incomplete?'；输出达到上限，内容不完整，请缩短输入后重试':''}${data.usage?.total_tokens!=null?`；原始生成 token：${data.usage.total_tokens}`:''}`);
    }catch(e){if(alive.current&&generation.current===n)failure(e);}finally{if(alive.current&&generation.current===n)setBusy(false);}
  };
  const upload=async(file:File)=>{
    reset();setText('');if(file.size>5*1024*1024){setError('文件最大5MB');return;}
    const n=generation.current;const c=new AbortController();controller.current=c;setBusy(true);
    const form=new FormData();form.append('projectId',project);form.append('file',file);
    try{const {data}=await api.post('/assistant/extract',form,{signal:c.signal,headers:{'x-organization-id':org}});
      if(!alive.current||generation.current!==n)return;
      setText(data.text);setInfo(`已提取文字，请检查后手动生成。文件不保存到附件库${data.truncated?'；提取结果已截断':''}`);
    }catch(e){if(alive.current&&generation.current===n)failure(e);}finally{if(alive.current&&generation.current===n)setBusy(false);}
  };
  const speak=()=>{
    stop();const utterance=new SpeechSynthesisUtterance(result.slice(0,4000));utterance.lang=mode==='translate-en'?'en-US':'zh-CN';
    utterance.onend=()=>{if(alive.current)setSpeaking(false);};utterance.onerror=()=>{if(alive.current){setSpeaking(false);setError('朗读失败，请检查系统语音与浏览器权限');}};
    setSpeaking(true);window.speechSynthesis.speak(utterance);
  };
  const cls=inputCls;
  const button='rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40';
  const loadHistory=async()=>{const n=generation.current;try{const {data}=await api.get('/assistant/mail',{params:{projectId:project},headers:{'x-organization-id':org}});if(alive.current&&n===generation.current){setHistory(data);if(mailIntent.current&&data.some((r:any)=>r.id===mailIntent.current?.id&&r.status==='ACCEPTED')){setMailUncertain(false);sessionStorage.removeItem(draftKey);setInfo('已核实上次邮件由服务商受理，尚不代表送达。请勿重复发送。');}}}catch(e){if(alive.current&&n===generation.current)failure(e);}};
  const sendMail=async()=>{
    if(!preview||mailBusy)return;setMailBusy(true);setError('');
    try{sessionStorage.setItem(draftKey,JSON.stringify(preview));}catch{setError('无法保存发送编号，请启用浏览器会话存储后重试，以免重复发信');setMailBusy(false);return;}
    try{const {data}=await api.post('/assistant/mail',{...preview,confirmed:true},{headers:{'x-organization-id':org}});
      if(!alive.current)return;sessionStorage.removeItem(draftKey);setInfo(`邮件服务已受理（${data.id}），尚不代表送达。`);setMailUncertain(false);setPreview(null);setResult('');mailIntent.current=null;void loadHistory();
    }catch(e:any){if(alive.current){const code=e.response?.status;const uncertain=!code||code>=500||code===409;setMailUncertain(uncertain);setPreview(null);if(!uncertain){sessionStorage.removeItem(draftKey);mailIntent.current=null;}failure(e);}}finally{if(alive.current)setMailBusy(false);}
  };
  return <section aria-label="协作助手" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">协作助手</h2><p className="mt-1 text-sm text-slate-500">先选择功能，再导入资料或直接编写。</p></div><span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs text-indigo-700">DeepSeek · {configured===null?'检查中':configured?'已配置':'未配置'}</span></div>
    <div aria-label="AI功能" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{assistantTools.map(t=><button key={t.id} type="button" disabled={mailBusy||mailUncertain} aria-pressed={mode===t.id} onClick={()=>{if(mode!==t.id){reset();setMode(t.id);}}} className={'flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50 '+(mode===t.id?'border-indigo-500 bg-indigo-600 text-white shadow-sm':'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50')}><t.icon size={21} className="shrink-0"/><span><span className="block text-sm font-semibold">{t.name}</span><span className={'mt-1 block text-xs '+(mode===t.id?'text-indigo-100':'text-slate-500')}>{t.hint}</span></span></button>)}</div>
    <div className="grid items-start gap-5 xl:grid-cols-2">
    <Card className="min-w-0 space-y-4 p-5 sm:p-6"><h3 className="font-semibold">01　选择项目与资料</h3>
    <label className="block">项目<select aria-label="项目" className={cls} disabled={mailBusy} value={project} onChange={e=>{reset();setHistory([]);setText('');setTo('');setProject(e.target.value);onProjectChange?.(e.target.value);}}><option value="">请选择可访问项目</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <FilePicker key={project} label="导入资料" disabled={!project||busy||mailBusy} accept=".docx,.pdf,.txt,.md" onFile={f=>void upload(f)} hint="DOCX、文字型 PDF（前30页）、TXT、MD · 最大5MB。仅提取文字，扫描件需先OCR。"/>
    <label className="block">资料正文<textarea aria-label="资料正文" className={cls} rows={9} maxLength={100000} value={text} onChange={e=>{reset();setText(e.target.value);}} placeholder="粘贴会议纪要、需求或交付说明（至少50字）"/></label>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={!project||text.trim().length<(translating?1:50)||(translating&&text.length>1200)||busy||mailBusy||configured!==true} onClick={generate}><Sparkles size={16}/>{busy?'处理中…':'生成'}</Button><span className="text-xs text-slate-500">{text.length}字；{translating&&text.length>1200?'超过翻译上限，请分段；':''}无自动重试</span></div>
    <p className="text-xs leading-5 text-slate-500">仅点击生成时调用 DeepSeek。{translating?'翻译每次最多1200字。':'摘要、行动项与邮件使用前6000字。'}生成前请核对资料。</p>
    <details className="text-xs leading-5 text-slate-500"><summary className="cursor-pointer">用量、隐私与朗读说明</summary><p className="mt-2">摘要/行动项/邮件输出上限700 token；翻译1200 token。每个组织用户每小时10次，相同内容15分钟内复用，无自动付费重试。生成时将文本发送至DeepSeek。朗读前4000字，不消耗模型 token；系统语音可能使用浏览器供应商的在线服务。</p></details>
    </Card>
    <div className="min-w-0 space-y-4">
    {error&&<p role="alert" className="text-red-700">{error}</p>}{info&&<p role="status" className="text-sm text-slate-600">{info}</p>}
    {!result&&mode!=='email'&&<Card className="flex min-h-80 flex-col items-center justify-center gap-3 p-8 text-center"><Sparkles size={32} className="text-indigo-300"/><h3 className="font-semibold">生成结果将显示在这里</h3><p className="text-sm text-slate-500">上传或粘贴资料，点击生成。你可以编辑、复制和朗读结果。</p></Card>}
    {(result||mode==='email')&&<section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="font-semibold">{mode==='email'?'邮件草稿（也可直接编写）':'生成结果'}</h2><label className="block">可修改结果<textarea aria-label="可修改结果" className={cls} disabled={mailBusy} rows={9} maxLength={10000} value={result} onChange={e=>{stop();setResult(e.target.value);}}/></label>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={!result.trim()} onClick={async()=>{try{await navigator.clipboard.writeText(result);setInfo('已复制');}catch{setError('复制失败，请选中文字手动复制');}}}>复制</button><button className={button} disabled={!speechAvailable||!result.trim()} onClick={speaking?()=>{if(window.speechSynthesis.paused)window.speechSynthesis.resume();else window.speechSynthesis.pause();}:speak}>{speaking?'暂停 / 继续朗读':'朗读结果'}</button><button className={button} disabled={!speaking} onClick={stop}>停止朗读</button></div>
      {mode==='email'&&<form className="space-y-3 border-t pt-4" onSubmit={e=>{e.preventDefault();const hash=JSON.stringify([project,to.trim(),subject.trim(),result.trim()]);if(mailUncertain&&mailIntent.current?.hash!==hash){setError('上次发送结果待核查，请先刷新记录；如需重试，请恢复原收件人、主题和正文，勿新建重复邮件。');return;}if(mailIntent.current?.hash!==hash)mailIntent.current={hash,id:crypto.randomUUID()};setPreview({to:to.trim(),subject:subject.trim(),text:result.trim(),projectId:project,requestId:mailIntent.current.id});}}><label className="block">收件人<input className={cls} disabled={mailBusy} type="email" required value={to} onChange={e=>setTo(e.target.value)}/></label><label className="block">主题<input className={cls} disabled={mailBusy} required maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)}/></label><div className="flex flex-wrap gap-3"><button className={button} type="submit" disabled={!project||!result.trim()||!mailReady||mailBusy}>预览并发送邮件</button><button className={button} type="button" disabled={!project} onClick={()=>void loadHistory()}>刷新发送记录</button></div><p className="text-xs text-slate-500">{mailReady?'使用现有Resend服务，需有项目写入及邀请发送权限；每小时最多20封。':'未配置真实邮件服务，当前不能发信。'} 发送记录不保存收件人和正文；结果不确定时保留相同编号重试，不自动重发。</p></form>}
    </section>}
    {history.length>0&&<section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">我的发送记录</h2>{history.map(r=><p className="break-all text-sm" key={r.id}>{r.id}：{r.status==='ACCEPTED'?'服务商已受理，尚不代表送达':r.status==='UNKNOWN'?'结果待核查，请勿重复新建':'处理中或中断待核查'} {r.provider_id||''}</p>)}</section>}
    <Modal open={!!preview} onClose={()=>{if(!mailBusy)setPreview(null);}} title="确认对外发送项目邮件"><div className="space-y-4"><p className="break-all">收件人：{preview?.to}</p><p>主题：{preview?.subject}</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-sm">{preview?.text}</pre><p className="text-sm text-slate-600">确认后将通过邮件服务对外发送以上内容。</p><button className={button} disabled={mailBusy} onClick={()=>void sendMail()}>{mailBusy?'发送中…':'确认发送'}</button></div></Modal>
    </div></div>
  </section>;
}
