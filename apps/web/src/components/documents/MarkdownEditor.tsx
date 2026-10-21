"use client";
import {useEffect,useState} from 'react';
import {DocumentProvider,from64} from '@/lib/document-provider';
import * as Y from 'yjs';
import SourceWorkspace from '../boards/MermaidWorkspace';
import {MarkdownPreview} from './MarkdownPreview';
import {api} from '@/lib/api';
export function MarkdownHistory({state}:{state:string}){
  const doc=new Y.Doc();let source='';try{Y.applyUpdate(doc,from64(state));source=doc.getText('markdown').toString();}finally{doc.destroy();}
  return <MarkdownPreview source={source}/>;
}
export default function MarkdownEditor({docId,org,user,onReady,onSelection}:{docId:string;org:string;user:string;onReady:(p:DocumentProvider)=>void;onSelection?:(value:any)=>void}){
  const [provider,setProvider]=useState<DocumentProvider|null>(null),[error,setError]=useState(''),[fileName,setFileName]=useState('document.md');const [,render]=useState(0);
  useEffect(()=>{
    let alive=true;const p=new DocumentProvider(docId,org,user),unsubscribe=p.subscribe(()=>{if(alive){setProvider(p);render(n=>n+1);}});
    void api.get(`/documents/${docId}`).then(r=>{if(alive)setFileName(r.data.title);}).catch(()=>{});
    void p.init().then(()=>{if(alive){setProvider(p);onReady(p);}}).catch(()=>setError('无法读取此设备的Markdown草稿，请检查浏览器存储。'));
    return ()=>{alive=false;unsubscribe();void p.destroy();};
  },[docId,org,user,onReady]);
  return error?<p role="alert">{error}</p>:provider?.ready?<SourceWorkspace provider={provider} format="markdown" onSelection={onSelection} fileName={fileName}/>:<p role="status">正在读取Markdown文件…</p>;
}
