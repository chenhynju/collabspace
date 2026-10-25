export type PersonaState='idle'|'listening'|'thinking'|'executing'|'awaiting-confirmation'|'speaking'|'completed'|'failed'|'cancelled';
export interface PersonaEvent {version:1;runId:string;sequence:number;source:'agent'|'skill';state:PersonaState;authority:'runtime';resultRef?:string;}
/** Runtime adapter contract only. UI cannot invent successful execution. */
export function applyPersonaEvent(previous:PersonaEvent|null,event:PersonaEvent):PersonaEvent {
 if(event.version!==1||event.authority!=='runtime'||!event.runId||!Number.isSafeInteger(event.sequence)||event.sequence<0||!['agent','skill'].includes(event.source)||!['idle','listening','thinking','executing','awaiting-confirmation','speaking','completed','failed','cancelled'].includes(event.state))throw Error('无效运行时事件');
 if(previous&&event.runId===previous.runId){
  if(event.sequence<=previous.sequence)return previous;
  if(['completed','failed','cancelled'].includes(previous.state))return previous;
 }
 if(event.state==='completed'&&!event.resultRef?.trim())throw Error('任务完成需要真实结果引用');
 return event;
}
