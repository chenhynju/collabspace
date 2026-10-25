import {flowNodes,isFlowSource} from './mermaid-edit';
import {nodePositions} from './mermaid-position';
export type CanvasNode={id:string;label:string;x:number;y:number;width:number;height:number;diamond:boolean};
/** Inspect generated SVG as inert XML; never execute or mount it in the parent document. */
export function flowSvgLayout(source:string,markup:string){
 const xml=new DOMParser().parseFromString(markup,'image/svg+xml'),svg=xml.documentElement,positions=nodePositions(source);
 const original=svg.getAttribute('viewBox')?.split(/[ ,]+/).map(Number)||[0,0,1000,700];
 const translate=(el:Element|null)=>{let x=0,y=0;for(let e=el;e&&e!==svg;e=e.parentElement){for(const m of (e.getAttribute('transform')||'').matchAll(/translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/g)){x+=+m[1];y+=+m[2];}}return{x,y};};
 const nodes:CanvasNode[]=[];if(isFlowSource(source))for(const n of flowNodes(source)){
  const el=[...svg.querySelectorAll('g.node')].find(e=>e.id.startsWith('flowchart-'+n.id+'-')||e.id.includes('-flowchart-'+n.id+'-'));if(!el)continue;
  const auto=translate(el),at=positions[n.id]||auto;if(!Number.isFinite(at.x)||!Number.isFinite(at.y))continue;
  const shape=el.querySelector('rect,circle,ellipse,polygon');let width=120,height=64;
  if(shape?.tagName==='rect'){width=+(shape.getAttribute('width')||120);height=+(shape.getAttribute('height')||64);}
  if(shape?.tagName==='circle'){width=height=2*+(shape.getAttribute('r')||40);}
  if(shape?.tagName==='ellipse'){width=2*+(shape.getAttribute('rx')||60);height=2*+(shape.getAttribute('ry')||32);}
  if(shape?.tagName==='polygon'){const points=(shape.getAttribute('points')||'').trim().split(/[\s,]+/).map(Number),xs=points.filter((_,i)=>i%2===0),ys=points.filter((_,i)=>i%2===1);if(xs.length&&ys.length){width=Math.max(...xs)-Math.min(...xs);height=Math.max(...ys)-Math.min(...ys);}}
  nodes.push({...n,...at,width:Math.max(20,width),height:Math.max(20,height),diamond:shape?.tagName==='polygon'});if(positions[n.id]){const parent=translate(el.parentElement);el.setAttribute('transform',`translate(${at.x-parent.x},${at.y-parent.y})`);}
 }
 for(const path of svg.querySelectorAll('.edgePaths path')){
  const starts=nodes.filter(a=>path.id.startsWith(`L_${a.id}_`)||path.id.includes(`-L_${a.id}_`)||path.classList.contains('LS-'+a.id));
  const pair=starts.flatMap(a=>nodes.filter(b=>path.id.startsWith(`L_${a.id}_${b.id}_`)||path.id.includes(`-L_${a.id}_${b.id}_`)||(path.classList.contains('LS-'+a.id)&&path.classList.contains('LE-'+b.id))).map(b=>[a,b]));
  if(pair.length!==1)continue;const [a,b]=pair[0];if(!positions[a.id]&&!positions[b.id])continue;
  const parent=translate(path.parentElement),dx=b.x-a.x,dy=b.y-a.y;
  const boundary=(node:CanvasNode)=>node.diamond?1/(Math.abs(dx)/(node.width/2)+Math.abs(dy)/(node.height/2)):Math.min(dx?node.width/2/Math.abs(dx):Infinity,dy?node.height/2/Math.abs(dy):Infinity);
  const sa=boundary(a),sb=boundary(b);if(!Number.isFinite(sa)||!Number.isFinite(sb))continue;
  const start={x:a.x-parent.x+dx*sa,y:a.y-parent.y+dy*sa},end={x:b.x-parent.x-dx*sb,y:b.y-parent.y-dy*sb};path.setAttribute('d',`M${start.x},${start.y} L${end.x},${end.y}`);
  const label=[...svg.querySelectorAll('[data-id]')].find(e=>e.getAttribute('data-id')===path.id);if(label&&label!==path){const p=translate(label.parentElement);label.setAttribute('transform',`translate(${(a.x+b.x)/2-p.x},${(a.y+b.y)/2-p.y})`);}
 }
 const width=Math.max(1000,original[0]+original[2]+40,...nodes.map(n=>n.x+200)),height=Math.max(800,original[1]+original[3]+40,...nodes.map(n=>n.y+140));
 if(nodes.length){svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.removeAttribute('style');}
 return {svg:new XMLSerializer().serializeToString(svg),nodes,width,height};
}
