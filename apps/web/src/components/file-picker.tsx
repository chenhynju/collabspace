'use client';
import {useId,useRef,useState} from 'react';
import {UploadCloud,FileCheck2} from 'lucide-react';

/** Keeps the native accessible input and file dialog; adds one shared drop target. */
export function FilePicker({label,accept,disabled,onFile,hint,required=false}:{label:string;accept?:string;disabled?:boolean;onFile:(file:File)=>void;hint?:string;required?:boolean}) {
 const id=useId(),input=useRef<HTMLInputElement>(null),[name,setName]=useState(''),[drag,setDrag]=useState(false);
 const choose=(file?:File)=>{if(!file||disabled)return;setName(file.name);onFile(file);if(!required&&input.current)input.current.value='';};
 return <div onDragOver={e=>{e.preventDefault();if(!disabled)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(disabled)return;const file=e.dataTransfer.files[0];if(file){const dt=new DataTransfer();dt.items.add(file);if(input.current)input.current.files=dt.files;choose(file);}}} className={'relative rounded-xl border-2 border-dashed p-5 transition focus-within:ring-2 focus-within:ring-indigo-500 '+(disabled?'border-slate-200 bg-slate-50 opacity-60':drag?'border-indigo-500 bg-indigo-100':'border-indigo-200 bg-indigo-50/50 hover:border-indigo-400')}>
  <input ref={input} id={id} aria-label={label} aria-describedby={id+'-hint'} type="file" accept={accept} disabled={disabled} required={required} className="sr-only" onChange={e=>choose(e.target.files?.[0])}/>
  <label htmlFor={id} className={'flex min-w-0 items-center gap-3 '+(disabled?'cursor-not-allowed':'cursor-pointer')}>
   <span className="shrink-0 rounded-xl bg-white p-3 text-indigo-600">{name?<FileCheck2 size={24}/>:<UploadCloud size={24}/>}</span>
   <span className="min-w-0"><span className="block break-all text-sm font-semibold text-indigo-800">{name||'点击选择或拖入文件'}</span><span className="mt-1 block text-xs text-slate-500">{name?'点击可重新选择':label}</span></span>
  </label>
  <p id={id+'-hint'} className="mt-3 text-xs leading-5 text-slate-500">{hint}</p>
 </div>;
}
