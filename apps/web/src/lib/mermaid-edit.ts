import {diagramShapes, type DiagramShape} from "./diagram-catalog";
const flowHeader=/^(\s*(?:(?:%%[^\n]*\n)\s*)*(?:flowchart|graph)\s+)(LR|RL|TB|TD|BT)\b/;
export function isFlowSource(source:string){return flowHeader.test(source);}
export function getFlowDirection(source:string){return flowHeader.exec(source)?.[2]?.replace('TD','TB')||'LR';}
// Source remains authoritative. Append-only operations preserve unsupported syntax.
export function flowNodes(source:string) {
  if(!isFlowSource(source)) return [];
  const nodes:{id:string;label:string}[]=[];
  const seen=new Set<string>();
  for(const line of source.split('\n')) {
    if(/^\s*%%/.test(line))continue;
    for(const m of line.matchAll(/\b([A-Za-z][\w]*)@\{\s*shape:\s*[a-z-]+,\s*label:\s*"([^"\n]+)"\s*\}/g)){if(!seen.has(m[1])){seen.add(m[1]);nodes.push({id:m[1],label:m[2]});}}
    for(const m of line.matchAll(/\b([A-Za-z][\w]*)\s*(?:\[([^\]\n]+)\]|\{([^}\n]+)\}|\(\(([^)\n]+)\)\))/g)) {
      if(!seen.has(m[1])){seen.add(m[1]);nodes.push({id:m[1],label:(m[2]||m[3]||m[4]).replace(/^"|"$/g,'')});}
    }
  }
  return nodes;
}
export function addFlowNode(source:string,label:string,kind:DiagramShape,id:string) {
  if(source.trim()&&!isFlowSource(source))throw Error('图形操作目前支持流程图，请保留当前源码或新建流程图。');
  if(!/^[A-Za-z][\w]*$/.test(id)||new RegExp(`\\b${id}\\b`).test(source))throw Error('节点标识冲突，请重试。');
  const clean=label.trim();if(!clean||clean.length>100||/["\n\r<>\[\]{}()\\]/.test(clean))throw Error('名称限100字，不能包含引号、括号或HTML符号。');
  const shape=diagramShapes.find(s=>s.key===kind);if(!shape)throw Error('不支持的图元。');
  return (source.trim()?source:'flowchart LR')+`\n  ${id}@{ shape: ${shape.shape}, label: "${clean}" }`;
}
export function connectFlowNodes(source:string,from:string,to:string,kind:'arrow'|'line'|'dashed'|'bold'|'both'='arrow',label='') {
  const ids=new Set(flowNodes(source).map(n=>n.id));
  if(!ids.has(from)||!ids.has(to)||from===to)throw Error('请连接两个不同的已定义节点。');
  const clean=label.trim();if(clean.length>80||/["\n\r<>|\\]/.test(clean))throw Error('连线标签限80字，不能包含引号、换行或HTML。');
  const op={arrow:'-->',line:'---',dashed:'-.->',bold:'==>',both:'<-->'}[kind];if(!op)throw Error('不支持的连线。');
  const edge=`${from} ${op}${clean?`|${clean}|`:''} ${to}`;
  if(source.split('\n').some(line=>line.trim()===edge))return source;
  return source+`\n  ${edge}`;
}
export function flowDirection(source:string,direction:string){
 if(!['LR','RL','TB','BT'].includes(direction))throw Error('不支持的布局方向。');
 if(!isFlowSource(source))throw Error('当前布局只支持流程图。');
 return source.replace(flowHeader,`$1${direction}`);
}
export function renameFlowNode(source:string,id:string,label:string){
 if(!/^[A-Za-z][\w]*$/.test(id))throw Error('节点标识无效。');
 const clean=label.trim();if(!clean||clean.length>100||/["\n\r<>\[\]{}()\\]/.test(clean))throw Error('名称限100字，不能包含引号、括号或HTML。');
 // Only replace an unambiguous simple definition; references/edges/comments stay byte-for-byte intact.
 const pattern=new RegExp(`\\b${id}(@\\{\\s*shape:\\s*[a-z-]+,\\s*label:\\s*"[^"\\n]+"\\s*\\}|\\["?[^\\]"\\n]+"?\\]|\\{"?[^}"\\n]+"?\\}|\\(\\("?[^)"\\n]+"?\\)\\))`,'g');
 const matches=[...source.matchAll(pattern)].filter(m=>!source.slice(source.lastIndexOf('\n',m.index)+1,m.index).trimStart().startsWith('%%'));
 if(matches.length!==1)throw Error('此节点定义复杂或重复，请通过源码修改名称。');
 const m=matches[0],old=m[0],next=old.includes('@{')?old.replace(/label:\s*"[^"\n]+"/,`label: "${clean}"`):old.startsWith(id+'((')?`${id}(("${clean}"))`:old.startsWith(id+'{')?`${id}{"${clean}"}`:`${id}["${clean}"]`;
 return source.slice(0,m.index)+next+source.slice(m.index!+old.length);
}
export function colorFlowNode(source:string,id:string,palette:string){
 if(!flowNodes(source).some(n=>n.id===id))throw Error('请选择已定义节点。');
 const colors:Record<string,string>={indigo:'#e0e7ff',teal:'#ccfbf1',amber:'#fef3c7',rose:'#ffe4e6',slate:'#e2e8f0'};
 if(!colors[palette])throw Error('不支持的颜色。');
 return source+`\n  style ${id} fill:${colors[palette]},stroke:#475569,color:#0f172a`;
}
export function mindNodes(source:string) {
  const lines=source.split('\n');if(lines[0].trim()!=='mindmap')return [];
  const nodes:{id:string;label:string;indent:number;line:number;end:number}[]=[];
  for(let line=1;line<lines.length;line++){
    if(!lines[line].trim())continue;
    const m=/^( *)([^\t]+)$/.exec(lines[line]);if(!m)return [];
    const raw=m[2],root=/^root\(\(([^()]+)\)\)$/.exec(raw);
    if(!root&&/[\[\]{}()<>"\\]|^%%|^::/.test(raw))return [];
    const indent=m[1].length;if(nodes.length&&indent<=nodes[0].indent)return [];
    nodes.push({id:'L'+line,label:root?root[1]:raw,indent,line,end:lines.length});
  }
  for(let i=0;i<nodes.length;i++)nodes[i].end=nodes.slice(i+1).find(n=>n.indent<=nodes[i].indent)?.line??lines.length;
  return nodes;
}
export function addMindNode(source:string,label:string,parentId?:string){
  const nodes=mindNodes(source),parent=nodes.find(n=>n.id===parentId)||nodes[0];if(!parent)throw Error('此思维导图含暂不支持的语法，请使用源码编辑。');
  const clean=label.trim();if(!clean||clean.length>100||/[\n\r"<>\[\]{}()\\]/.test(clean)||/^%%|^::/.test(clean))throw Error('主题名称包含不支持的符号。');
  const lines=source.split('\n');lines.splice(parent.end,0,' '.repeat(parent.indent+2)+clean);return lines.join('\n');
}
export function moveMindBranch(source:string,id:string,parentId:string){
  const nodes=mindNodes(source),node=nodes.find(n=>n.id===id),parent=nodes.find(n=>n.id===parentId);
  if(!node||!parent||node===nodes[0]||(parent.line>=node.line&&parent.line<node.end))throw Error('不能移动根主题或把主题移入自己的子树。');
  const lines=source.split('\n'),delta=parent.indent+2-node.indent;
  const block=lines.slice(node.line,node.end).map(line=>line.trim()?' '.repeat(Math.max(0,line.search(/\S/)+delta))+line.trimStart():line);
  lines.splice(node.line,node.end-node.line);
  const at=parent.end>node.line?parent.end-(node.end-node.line):parent.end;lines.splice(at,0,...block);return lines.join('\n');
}

export function duplicateFlowNode(source:string,id:string,newId:string){
 const node=flowNodes(source).find(n=>n.id===id);if(!node)throw Error('请选择已定义节点。');
 const modern=new RegExp(`\\b${id}@\\{\\s*shape:\\s*([a-z-]+),`).exec(source);
 const shape=modern?diagramShapes.find(s=>s.shape===modern[1]):undefined;
 if(modern&&!shape)throw Error('此图元暂不支持复制，请使用源码。');
 const legacy=new RegExp(`\\b${id}\\s*\\{`).test(source)?'decision':new RegExp(`\\b${id}\\s*\\(\\(`).test(source)?'start':'process';
 return addFlowNode(source,node.label.slice(0,94)+' 副本',shape?.key||legacy,newId);
}
export function deleteFlowNode(source:string,id:string){
 if(!/^[A-Za-z][\w]*$/.test(id))throw Error('节点标识无效。');
 const lines=source.split('\n'),definition=new RegExp(`^\\s*${id}@\\{\\s*shape:\\s*[a-z-]+,\\s*label:\\s*"[^"\\n]+"\\s*\\}\\s*$`);
 if(lines.filter(line=>definition.test(line)).length!==1)throw Error('仅独立定义的标准图元支持安全删除；复杂节点请通过源码修改。');
 const edge=/^\s*([A-Za-z][\w]*)\s+(?:<-->|-->|---|-\.->|==>)(?:\|[^|\n]*\|)?\s+([A-Za-z][\w]*)\s*$/;
 const style=new RegExp(`^\\s*style\\s+${id}\\s+fill:#[0-9a-f]{6},stroke:#475569,color:#0f172a\\s*$`);
 const remaining=lines.filter(line=>{const m=edge.exec(line);return !definition.test(line)&&!style.test(line)&&!(m&&(m[1]===id||m[2]===id));}).join('\n');
 if(new RegExp(`\\b${id}\\b`).test(remaining))throw Error('此节点仍被分组、样式或复杂连线引用，请通过源码删除，避免误删其他内容。');
 return remaining;
}
