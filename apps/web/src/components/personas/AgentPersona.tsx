'use client';
import {useEffect,useRef,useState} from 'react';
import {applyPersonaEvent,PersonaEvent} from './persona-events';
const labels={idle:'待命',listening:'聆听',thinking:'思考',executing:'执行中','awaiting-confirmation':'等待确认',speaking:'播报中',completed:'已完成',failed:'失败',cancelled:'已取消'};
/** Consumed by a trusted run adapter. This component has no tool-execution authority. */
export function AgentPersona({name,event,skill,onStopSpeech}:{name:string;event:PersonaEvent|null;skill?:string;onStopSpeech?:()=>void}){
 const [current,setCurrent]=useState<PersonaEvent|null>(null),[error,setError]=useState('');
 const latest=useRef<PersonaEvent|null>(null);
 useEffect(()=>{if(!event)return;try{latest.current=applyPersonaEvent(latest.current,event);setCurrent(latest.current);setError('');}catch{setError('运行事件无效，未更新状态');}},[event]);
 return <section aria-label="Agent身份卡" className="rounded-lg border bg-indigo-50 p-3 text-sm"><strong>{name}</strong><span className="ml-2 rounded bg-indigo-100 px-2">AI Agent</span><p>{current?labels[current.state]:'尚未连接运行时'}</p>{skill&&<p>调用能力：{skill} · 调用者：{name}</p>}{current?.state==='completed'&&<p>结果引用：{current.resultRef}</p>}{onStopSpeech&&<button type="button" onClick={onStopSpeech}>停止播报（不取消任务）</button>}{error&&<p role="alert">{error}</p>}</section>;
}
