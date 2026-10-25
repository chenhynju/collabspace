'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui';
import {Disclosure} from '@/components/disclosure';
import {applyPersonaEvent,PersonaEvent} from './persona-events';
const labels={idle:'待命',listening:'聆听',thinking:'思考',executing:'执行中','awaiting-confirmation':'等待确认',speaking:'播报中',completed:'已完成',failed:'失败',cancelled:'已取消'};
const skills:Record<string,string>={summary:'资料摘要',actions:'行动项提取',email:'邮件草稿','translate-en':'中译英','translate-zh':'英译中'};
/** Consumed by a trusted run adapter. This component has no tool-execution authority. */
export function AgentPersona({name,event,skill,onStopSpeech}:{name:string;event:PersonaEvent|null;skill?:string;onStopSpeech?:()=>void}){
 const [current,setCurrent]=useState<PersonaEvent|null>(null),[error,setError]=useState('');
 const latest=useRef<PersonaEvent|null>(null);
 useEffect(()=>{if(!event)return;try{latest.current=applyPersonaEvent(latest.current,event);setCurrent(latest.current);setError('');}catch{setError('运行事件无效，未更新状态');}},[event]);
 return <section aria-label="Agent身份卡" className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm"><div className="flex items-center gap-2"><strong>{name}</strong><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs">AI Agent</span><span className="ml-auto">{current?labels[current.state]:'尚未连接运行时'}</span></div>{skill&&<p className="text-slate-600">{skills[skill]||skill}</p>}{current?.state==='completed'&&<p>结果已生成，可在下方查看和编辑。</p>}{onStopSpeech&&<Button type="button" variant="secondary" size="sm" onClick={onStopSpeech}>停止播报（不取消任务）</Button>}{current&&<Disclosure title="运行详情" className="text-xs text-slate-500"><p className="mt-2 break-all">运行编号：{current.runId}</p>{current.resultRef&&<p className="break-all">结果引用：{current.resultRef}</p>}</Disclosure>}{error&&<p role="alert">{error}</p>}</section>;
}
