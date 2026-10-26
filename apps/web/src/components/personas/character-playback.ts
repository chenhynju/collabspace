import type {CharacterPlayback} from './AvatarPreview';
type Listener=(playback:CharacterPlayback|null)=>void;
const listeners=new Map<string,Set<Listener>>();
let active:{key:string;playback:CharacterPlayback;token:symbol}|null=null;
const notify=(key:string,value:CharacterPlayback|null)=>listeners.get(key)?.forEach(cb=>cb(value));
export function observeCharacter(key:string,listener:Listener){
 const set=listeners.get(key)||new Set<Listener>();set.add(listener);listeners.set(key,set);listener(active?.key===key?active.playback:null);
 return()=>{set.delete(listener);if(!set.size)listeners.delete(key);};
}
/** Only one scoped character may speak. An old component cannot release a new session. */
export function publishCharacter(key:string,playback:CharacterPlayback){
 if(active){active.playback.audio.pause();notify(active.key,null);}
 const session={key,playback,token:Symbol()};active=session;notify(key,playback);
 return()=>{playback.audio.pause();if(active?.token===session.token){active=null;notify(key,null);}};
}
