"use client";
/* eslint-disable @next/next/no-img-element -- Private authenticated Blob URLs cannot use the Next.js image optimizer. */
import { useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { api } from "@/lib/api";

function ImageView({node,extension,selected}:NodeViewProps) {
  const [url,setUrl]=useState(""),[error,setError]=useState("");
  const {documentId,organizationId}=extension.options;
  const assetId=node.attrs.assetId;
  useEffect(()=>{
    const abort=new AbortController(); let objectUrl=""; setUrl("");setError("");
    if(!/^[a-f0-9-]{36}$/i.test(assetId || "")) {setError("图片引用无效");return;}
    void api.get(`/documents/${documentId}/images/${assetId}`,{responseType:"blob",headers:{"x-organization-id":organizationId},signal:abort.signal}).then(r=>{
      if(abort.signal.aborted)return;
      objectUrl=URL.createObjectURL(r.data);setUrl(objectUrl);
    }).catch(()=>{if(!abort.signal.aborted)setError("图片暂时无法读取，请联网后重新打开文档，或检查访问权限。");});
    return ()=>{abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[documentId,organizationId,assetId]);
  return <NodeViewWrapper as="figure" className={`document-image ${selected?"is-selected":""}`} data-asset-id={assetId} contentEditable={false} style={{width:`${[50,75,100].includes(node.attrs.width)?node.attrs.width:100}%`}}>
    {url ? <img src={url} alt={node.attrs.alt || "文档配图"} draggable={false} /> : <div className="rounded bg-slate-100 p-8 text-center text-sm text-slate-500">{error || "正在加载图片…"}</div>}
    {node.attrs.caption && <figcaption>{node.attrs.caption}</figcaption>}
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
