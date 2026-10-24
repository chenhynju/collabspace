"use client";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
export function formulaHTML(latex: string) {
  if (!latex.trim() || latex.length > 8000) throw new Error("公式不能为空，且最多 8000 字符。");
  return katex.renderToString(latex, {displayMode:true,throwOnError:true,trust:false,maxExpand:200,maxSize:20});
}
function FormulaView({node,selected}:NodeViewProps) {
  let html="",error="";
  try {html=formulaHTML(String(node.attrs.latex));} catch {error="公式语法无效，请选中公式后修改源码。";}
  return <NodeViewWrapper contentEditable={false} className={`my-3 overflow-x-auto rounded border p-3 ${selected?"border-blue-500":"border-slate-200"}`}>
    {error?<span role="alert">{error}</span>:<span dangerouslySetInnerHTML={{__html:html}} />}
  </NodeViewWrapper>;
}
export const DocumentFormula=Node.create({
  name:"documentFormula",group:"block",atom:true,draggable:true,selectable:true,
  addAttributes(){return {latex:{default:"",parseHTML:el=>el.getAttribute("data-latex") || ""}};},
  parseHTML(){return [{tag:"div[data-document-formula]"}];},
  renderHTML({node,HTMLAttributes}){return ["div",mergeAttributes(HTMLAttributes,{"data-document-formula":"true","data-latex":node.attrs.latex}),node.attrs.latex];},
  renderText({node}){return `$$${node.attrs.latex}$$`;},
  addNodeView(){return ReactNodeViewRenderer(FormulaView);},
});
