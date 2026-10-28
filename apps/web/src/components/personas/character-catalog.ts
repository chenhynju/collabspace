import {CHARACTER_CATALOG} from '@collabspace/protocol/personas';
export const characters=CHARACTER_CATALOG;

export type MouthWeights={aa:number;ih:number;ou:number;ee:number;oh:number};
export type VisemeFrame={offsetMs:number;id:number};
const silent=():MouthWeights=>({aa:0,ih:0,ou:0,ee:0,oh:0});
/** Coarse VRM mapping; the model-specific map can refine these five vowels. */
export function mouthAt(track:VisemeFrame[],seconds:number,playing:boolean):MouthWeights{
 if(!playing||!Number.isFinite(seconds)||seconds<0||!track.length)return silent();
 const t=seconds*1000;let lo=0,hi=track.length-1,at=-1;
 while(lo<=hi){const m=(lo+hi)>>1;if(track[m].offsetMs<=t){at=m;lo=m+1;}else hi=m-1;}
 if(at<0||t-track[at].offsetMs>250)return silent();
 const id=track[at].id,weights=silent();
 const vowel:Record<number,keyof MouthWeights>={1:'aa',2:'aa',3:'oh',4:'ee',5:'oh',6:'ih',7:'ou',8:'oh',9:'aa',10:'oh',11:'aa',12:'aa',13:'aa',14:'ee',15:'ih',16:'ih',17:'ih',18:'ee',19:'aa',20:'aa',21:'aa'};
 if(id===0||!vowel[id])return weights;
 // Silence wins for closures; do not open the mouth for bilabial /p,b,m/.
 if(id===21)return weights;
 weights[vowel[id]]=Math.min(1,(t-track[at].offsetMs+15)/60)*.7;return weights;
}
