/** Portable application layout annotations: valid Mermaid comments, shared with the source. */
const marker=/^\s*%% collab-position ([A-Za-z][\w]*) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)\s*$/;
export function nodePositions(source:string){const out:Record<string,{x:number;y:number}>={};for(const line of source.split('\n')){const m=marker.exec(line);if(m&&+m[2]<=8000&&+m[3]<=8000)out[m[1]]={x:+m[2],y:+m[3]};}return out;}
export function positionNode(source:string,id:string,x:number,y:number){
 if(!/^[A-Za-z][\w]*$/.test(id)||!Number.isFinite(x)||!Number.isFinite(y)||x<20||y<20||x>8000||y>8000)throw Error('图元位置超出画布范围。');
 assertPositionable(source);
 const lines=source.split('\n').filter(line=>marker.exec(line)?.[1]!==id);return lines.join('\n')+`\n%% collab-position ${id} ${Math.round(x)} ${Math.round(y)}`;
}
/** Refuse geometries not yet safely rerouted; do not silently detach edges or groups. */
export function assertPositionable(source:string){
 if(/^\s*subgraph\b/m.test(source)||/\b[A-Za-z]\w*@\s*(?:--|==|-\.|<)/.test(source))throw Error('此图含分组或自定义连线，自由定位暂不支持；源码未修改。');
 const plain=source.split('\n').filter(line=>!/^\s*%%/.test(line)).join('\n').replace(/@\{[^\n}]*\}|\[(?:"[^"\n]*"|[^\]\n]*)\]|\(\((?:"[^"\n]*"|[^)\n]*)\)\)|\{(?:"[^"\n]*"|[^}\n]*)\}/g,'');
 const pairs=new Set<string>();for(const e of plain.matchAll(/(?=\b([A-Za-z]\w*)\s*(?:<-->|-->|---|-\.->|==>)(?:\|[^|\n]*\|)?\s*([A-Za-z]\w*))/g)){
  const pair=[e[1],e[2]].join(':');if(e[1]===e[2]||pairs.has(pair))throw Error('此图含自环或平行连线，自由定位暂不支持；源码未修改。');pairs.add(pair);
 }
}
export function removeNodePositions(source:string,ids:Set<string>){return source.split('\n').filter(line=>{const m=marker.exec(line);return !m||!ids.has(m[1]);}).join('\n');}
