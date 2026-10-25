/** Portable application layout annotations: valid Mermaid comments, shared with the source. */
const marker=/^\s*%% collab-position ([A-Za-z][\w]*) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)\s*$/;
export function nodePositions(source:string){const out:Record<string,{x:number;y:number}>={};for(const line of source.split('\n')){const m=marker.exec(line);if(m&&+m[2]<=8000&&+m[3]<=8000)out[m[1]]={x:+m[2],y:+m[3]};}return out;}
export function positionNode(source:string,id:string,x:number,y:number){
 if(!/^[A-Za-z][\w]*$/.test(id)||!Number.isFinite(x)||!Number.isFinite(y)||x<20||y<20||x>8000||y>8000)throw Error('图元位置超出画布范围。');
 const lines=source.split('\n').filter(line=>marker.exec(line)?.[1]!==id);return lines.join('\n')+`\n%% collab-position ${id} ${Math.round(x)} ${Math.round(y)}`;
}
export function removeNodePositions(source:string,ids:Set<string>){return source.split('\n').filter(line=>{const m=marker.exec(line);return !m||!ids.has(m[1]);}).join('\n');}
