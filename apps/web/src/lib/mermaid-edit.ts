// Source remains authoritative. Append-only operations preserve unsupported syntax.
export function flowNodes(source:string) {
  if(!/^\s*(?:flowchart|graph)\s+(?:LR|RL|TB|TD|BT)\b/.test(source)) return [];
  const nodes:{id:string;label:string}[]=[];
  const seen=new Set<string>();
  for(const line of source.split('\n')) {
    if(/^\s*%%/.test(line))continue;
    for(const m of line.matchAll(/\b([A-Za-z][\w]*)\s*(?:\[([^\]\n]+)\]|\{([^}\n]+)\}|\(\(([^)\n]+)\)\))/g)) {
      if(!seen.has(m[1])){seen.add(m[1]);nodes.push({id:m[1],label:(m[2]||m[3]||m[4]).replace(/^"|"$/g,'')});}
    }
  }
  return nodes;
}
export function addFlowNode(source:string,label:string,kind:'process'|'decision'|'start',id:string) {
  if(source.trim()&&!/^\s*(?:flowchart|graph)\s+(?:LR|RL|TB|TD|BT)\b/.test(source))throw Error('图形操作目前支持流程图，请保留当前源码或新建流程图。');
  if(!/^[A-Za-z][\w]*$/.test(id)||new RegExp(`\\b${id}\\b`).test(source))throw Error('节点标识冲突，请重试。');
  const clean=label.trim();if(!clean||clean.length>100||/["\n\r<>\[\]{}()\\]/.test(clean))throw Error('名称限100字，不能包含引号、括号或HTML符号。');
  const shape=kind==='decision'?`{"${clean}"}`:kind==='start'?`(("${clean}"))`:`["${clean}"]`;
  return (source.trim()?source:'flowchart LR')+`\n  ${id}${shape}`;
}
export function connectFlowNodes(source:string,from:string,to:string) {
  const ids=new Set(flowNodes(source).map(n=>n.id));
  if(!ids.has(from)||!ids.has(to)||from===to)throw Error('请连接两个不同的已定义节点。');
  if(new RegExp(`\\b${from}\\s*-->\\s*${to}\\b`).test(source))return source;
  return source+`\n  ${from} --> ${to}`;
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
