'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui';
import {Disclosure} from '@/components/disclosure';
import dynamic from 'next/dynamic';
import {api} from '@/lib/api';
import {characters} from './character-catalog';
import {observeCharacter} from './character-playback';
import {useAuthStore} from '@/store/auth';
import type {CharacterPlayback} from './AvatarPreview';
const AvatarPreview=dynamic(()=>import('./AvatarPreview'),{ssr:false});
import {applyPersonaEvent,PersonaEvent} from './persona-events';
const labels={idle:'待命',listening:'聆听',thinking:'思考',executing:'执行中','awaiting-confirmation':'等待确认',speaking:'播报中',completed:'已完成',failed:'失败',cancelled:'已取消'};
const skills:Record<string,string>={summary:'资料摘要',actions:'行动项提取',email:'邮件草稿','translate-en':'中译英','translate-zh':'英译中'};
/** Consumed by a trusted run adapter. This component has no tool-execution authority. */
export function AgentPersona({name,event,skill,onStopSpeech,active=true,projectId=''}:{name:string;event:PersonaEvent|null;skill?:string;onStopSpeech?:()=>void;active?:boolean;projectId?:string}){
 const [current,setCurrent]=useState<PersonaEvent|null>(null),[error,setError]=useState('');
 const [stage,setStage]=useState(false);
 const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id),[playback,setPlayback]=useState<CharacterPlayback|null>(null);
 useEffect(()=>observeCharacter(JSON.stringify([org,user,projectId,'assistant']),setPlayback),[org,user,projectId]);
 useEffect(()=>{if(!active)setStage(false);},[active]);
 const [characterId,setCharacterId]=useState<string|null>(null),[appearanceError,setAppearanceError]=useState('');
 useEffect(()=>{let c=new AbortController();const load=()=>{c.abort();c=new AbortController();const signal=c.signal;void api.get('/voice/persona/agent',{signal}).then(r=>{if(signal.aborted)return;if(!characters.some(item=>item.id===r.data.presetId))throw Error('角色资源尚未安装');setCharacterId(r.data.presetId);setAppearanceError('');}).catch(()=>{if(!signal.aborted){setCharacterId(null);setAppearanceError('形象配置未加载，可重开页面重试。');}});};load();const update=(event:Event)=>{if((event as CustomEvent).detail?.org===org)load();};window.addEventListener('collabspace:persona-config-changed',update);return()=>{c.abort();window.removeEventListener('collabspace:persona-config-changed',update);};},[org,user]);
 const character=characters.find(item=>item.id===characterId);
 const latest=useRef<PersonaEvent|null>(null);
 useEffect(()=>{if(!event)return;try{latest.current=applyPersonaEvent(latest.current,event);setCurrent(latest.current);setError('');}catch{setError('运行事件无效，未更新状态');}},[event]);
 return <section aria-label="Agent身份卡" className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm"><div className="flex items-center gap-2">{character?<img src={character.poster} alt={character.name+' · 当前Agent形象'} className="h-10 w-10 rounded-full object-cover object-top"/>:<span className="rounded-full bg-white p-2 text-xs">AI</span>}<strong>{name}</strong><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs">AI Agent</span><span className="ml-auto">{current?labels[current.state]:'尚未连接运行时'}</span></div><Button type="button" size="sm" variant="secondary" disabled={!character} onClick={()=>setStage(v=>!v)} aria-expanded={stage}>{stage?'收起形象':'查看Agent形象'}</Button>{stage&&active&&character&&<div className="max-w-[240px]"><AvatarPreview characterId={character.id} playback={playback} active={active} vrmUrl={character.modelUrl||undefined}/><p className="mt-1 text-xs text-slate-500">{character.name} · {character.description}。形象不代表任务完成。</p></div>}{appearanceError&&<p role="status" className="text-xs text-slate-500">{appearanceError}</p>}{skill&&<p className="text-slate-600">{skills[skill]||skill}</p>}{current?.state==='completed'&&<p>结果已生成，可在下方查看和编辑。</p>}{onStopSpeech&&<Button type="button" variant="secondary" size="sm" onClick={onStopSpeech}>停止播报（不取消任务）</Button>}{current&&<Disclosure title="运行详情" className="text-xs text-slate-500"><p className="mt-2 break-all">运行编号：{current.runId}</p>{current.resultRef&&<p className="break-all">结果引用：{current.resultRef}</p>}</Disclosure>}{error&&<p role="alert">{error}</p>}</section>;
}
