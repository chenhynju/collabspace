export interface CharacterPreset {
 readonly id:string; readonly name:string; readonly gender:'male'|'female';
 readonly description:string; readonly revision:string; readonly poster:string;
 readonly representation:'portrait'; readonly modelUrl:null;
}
export const CHARACTER_CATALOG:readonly CharacterPreset[];
export function characterById(id:string):CharacterPreset|undefined;
export function appearanceInput(body:unknown):{mode:'preset';presetId:string;revision:number};
