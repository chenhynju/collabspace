"use client";
/* eslint-disable @next/next/no-img-element -- Private authenticated Blob URLs cannot use the Next.js image optimizer. */
import { useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { api } from "@/lib/api";
import {imageCache} from '@/lib/document-image-cache';
import {useAuthStore} from '@/store/auth';

function ImageView({node,extension,selected}:NodeViewProps) {
  const [url,setUrl]=useState(""),[error,setError]=useState("");
  const {documentId,organizationId}=extension.options;
  const assetId=node.attrs.assetId;
  const user=useAuthStore(s=>s.user?.id);
  useEffect(()=>{
    const abort=new AbortController(); let objectUrl=""; setUrl("");setError("");
    if(!/^[a-f0-9-]{36}$/i.test(assetId || "")) {setError("图片引用无效");return;}
    const show=(blob:Blob)=>{if(!abort.signal.aborted){if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}};
    const cache=(op:'read'|'write'|'delete',blob?:Blob)=>user?imageCache(user,organizationId,documentId,assetId,op,blob):Promise.resolve(undefined);
    const load=async()=>{
      try{
        const r=await api.get(`/documents/${documentId}/images/${assetId}`,{responseType:"blob",headers:{"x-organization-id":organizationId},signal:abort.signal});
        if(abort.signal.aborted)return;show(r.data);await cache('write',r.data).catch(()=>{});
      }catch(e:any){
        if(abort.signal.aborted)return;
        if([401,403,404].includes(e.response?.status)){await cache('delete').catch(()=>{});setError('图片权限已失效或资源不存在。');return;}
        const saved=await cache('read').catch(()=>undefined);
        if(saved){show(saved);setError('离线配图');}else setError('尚无本地配图，请联网打开一次后再离线使用。');
      }
    };
    const revoked=(e:Event)=>{const detail=(e as CustomEvent).detail;if(detail.org===organizationId&&detail.docId===documentId){abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);setUrl('');setError('文档权限已撤销，本地配图缓存已清除。');}};
    void load();window.addEventListener('online',load);
    window.addEventListener('collabspace:document-revoked',revoked);
    return ()=>{window.removeEventListener('collabspace:document-revoked',revoked);window.removeEventListener('online',load);abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[documentId,organizationId,assetId,user]);
  return <NodeViewWrapper as="figure" className={`document-image ${selected?"is-selected":""}`} data-asset-id={assetId} contentEditable={false} style={{width:`${[50,75,100].includes(node.attrs.width)?node.attrs.width:100}%`}}>
    {url ? <img src={url} alt={node.attrs.alt || "文档配图"} draggable={false} /> : <div className="rounded bg-slate-100 p-8 text-center text-sm text-slate-500">{error || "正在加载图片…"}</div>}
    {node.attrs.caption && <figcaption>{node.attrs.caption}</figcaption>}
    {url&&error&&<span className="block text-xs text-amber-700">{error}</span>}
  </NodeViewWrapper>;
}
export const DocumentImage=Node.create({
  name:"documentImage",group:"block",atom:true,draggable:true,selectable:true,
  addOptions(){return {documentId:"",organizationId:""};},
  addAttributes(){return {
    assetId:{default:"",parseHTML:el=>el.getAttribute("data-asset-id") || "",renderHTML:attrs=>({"data-asset-id":attrs.assetId})},
    alt:{default:"文档配图",parseHTML:el=>el.getAttribute("data-alt") || "文档配图",renderHTML:attrs=>({"data-alt":attrs.alt})},
    caption:{default:"",parseHTML:el=>el.getAttribute("data-caption") || "",renderHTML:attrs=>({"data-caption":attrs.caption})},
    width:{default:100,parseHTML:el=>[50,75,100].includes(Number(el.getAttribute("data-width")))?Number(el.getAttribute("data-width")):100,renderHTML:attrs=>({"data-width":attrs.width})},
  };},
  // Only app-owned figure markup carries image IDs. Pasted external <img> is
  // intentionally not a renderable node; actual image files use authenticated upload.
  parseHTML(){return [{tag:"figure[data-document-image]"}];},
  renderHTML({HTMLAttributes}){return ["figure",mergeAttributes(HTMLAttributes,{"data-document-image":"true"}),["span",{},HTMLAttributes["data-caption"] || "文档配图"]];},
  addNodeView(){return ReactNodeViewRenderer(ImageView);},
});
