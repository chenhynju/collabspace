import type {DiagramShape} from '@/lib/diagram-catalog';
export default function DiagramGlyph({kind}:{kind:DiagramShape}){
 const p={fill:'#eef2ff',stroke:'currentColor',strokeWidth:1.5};
 let shape;
 if(['start','end','person'].includes(kind))shape=<><ellipse cx="28" cy="18" rx="15" ry="15" {...p}/>{kind==='end'&&<ellipse cx="28" cy="18" rx="11" ry="11" fill="none" stroke="currentColor"/>}</>;
 else if(kind==='decision')shape=<polygon points="28,2 53,18 28,34 3,18" {...p}/>;
 else if(['database','disk','queue','stored'].includes(kind))shape=<><path d="M8 9V27C8 36 48 36 48 27V9" {...p}/><ellipse cx="28" cy="9" rx="20" ry="7" {...p}/>{kind==='disk'&&<path d="M8 17C8 26 48 26 48 17" fill="none" stroke="currentColor"/>}</>;
 else if(['document','documents'].includes(kind))shape=<>{kind==='documents'&&<path d="M13 2H52V28" fill="none" stroke="currentColor"/>}<path d="M6 5H47V29C35 20 20 38 6 29Z" {...p}/></>;
 else if(kind==='cloud')shape=<path d="M12 29C0 29 1 14 12 14C10 0 30 0 33 10C44 4 55 15 49 24C47 32 33 30 12 29Z" {...p}/>;
 else if(['preparation','event'].includes(kind))shape=<polygon points="12,4 44,4 54,18 44,32 12,32 2,18" {...p}/>;
 else if(kind==='triangle')shape=<polygon points="28,2 54,33 2,33" {...p}/>;
 else if(kind==='data')shape=<polygon points="13,4 54,4 43,32 2,32" {...p}/>;
 else if(kind==='manual')shape=<polygon points="6,12 50,3 50,32 6,32" {...p}/>;
 else if(kind==='junction')shape=<rect x="4" y="13" width="48" height="10" rx="1" fill="currentColor"/>;
 else if(kind==='delay')shape=<path d="M6 4H31C57 4 57 32 31 32H6Z" {...p}/>;
 else shape=<><rect x="4" y="4" width="48" height="28" rx={['terminal','service'].includes(kind)?12:2} {...p}/>{kind==='subprocess'&&<path d="M11 4V32M45 4V32" stroke="currentColor"/>}{kind==='note'&&<path d="M4 12L12 4" stroke="currentColor"/>}</>;
 return <svg viewBox="0 0 56 36" className="mx-auto mb-2 h-8 w-12 text-indigo-500" aria-hidden="true">{shape}</svg>;
}
