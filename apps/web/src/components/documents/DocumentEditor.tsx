"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import LinkExtension from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import * as Y from "yjs";
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from "y-prosemirror";
import { DocumentProvider, from64, to64 } from "@/lib/document-provider";
import { api } from "@/lib/api";
import { DocumentFormula, formulaHTML } from "./DocumentFormula";
import { FormulaPalette, LATEX_DND_TYPE } from "./FormulaPalette";
import { DocumentImage } from "./DocumentImage";

function positions(provider: DocumentProvider) {
  return Extension.create({
    name: "remoteSelections",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations(state) {
              const sync = ySyncPluginKey.getState(state);
              if (!sync?.binding) return null;
              const items: Decoration[] = [];
              for (const m of provider.members) {
                if (!m.selection) continue;
                try {
                  const a = relativePositionToAbsolutePosition(
                      provider.doc,
                      sync.type,
                      Y.decodeRelativePosition(from64(m.selection.anchor)),
                      sync.binding.mapping,
                    ),
                    b = relativePositionToAbsolutePosition(
                      provider.doc,
                      sync.type,
                      Y.decodeRelativePosition(from64(m.selection.head)),
                      sync.binding.mapping,
                    );
                  if (a === null || b === null) continue;
                  const color = `hsl(${[...m.userId].reduce((n, c) => n + c.charCodeAt(0), 0) % 360} 65% 42%)`;
                  if (a !== b)
                    items.push(
                      Decoration.inline(Math.min(a, b), Math.max(a, b), {
                        style: `background:${color.replace("42%", "90%")}`,
                      }),
                    );
                  items.push(
                    Decoration.widget(
                      b,
                      () => {
                        const el = document.createElement("span");
                        el.className = "collab-caret";
                        el.style.borderColor = color;
                        el.setAttribute("aria-label", `${m.name} 的光标`);
                        const label = document.createElement("span");
                        label.textContent = m.name;
                        label.style.background = color;
                        el.append(label);
                        return el;
                      },
                      { key: m.sessionId },
                    ),
                  );
                } catch {
                  continue;
                }
              }
              return DecorationSet.create(state.doc, items);
            },
          },
        }),
      ];
    },
  });
}
export function RichEditor({
  provider,
  onSelection,
  organizationId,
}: {
  provider: DocumentProvider;
  organizationId: string;
  onSelection: (
    v: { quote: string; anchor: { start: string; end: string } } | null,
  ) => void;
}) {
  const [formulaOpen,setFormulaOpen]=useState(false),[latex,setLatex]=useState(""),[formulaError,setFormulaError]=useState("");
  const [, render] = useState(0);
  const [uploading,setUploading]=useState(false),[imageError,setImageError]=useState("");
  const fileInput=useRef<HTMLInputElement>(null),mounted=useRef(true),busy=useRef(false);
  const captionInput=useRef<HTMLInputElement>(null);
  const captionDirty=useRef(false),captionAsset=useRef("");
  const uploadRef=useRef<(files:File[],position?:number)=>void>(()=>{});
  const [linkOpen,setLinkOpen]=useState(false),[link,setLink]=useState("");
  const [imageCaption,setImageCaption]=useState("");
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[provider]);
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ history: false }),
        LinkExtension.configure({
          openOnClick: false,
          protocols: ["https", "http"],
          HTMLAttributes: { rel: "noopener noreferrer" },
        }),
        DocumentFormula,
        TaskList,
        TaskItem.configure({ nested: true }),
        DocumentImage.configure({documentId:provider.docId,organizationId}),
        Collaboration.configure({ document: provider.doc }),
        positions(provider),
      ],
      editable: provider.writable,
      editorProps: {
        handlePaste: (_view,event) => {
          const files=Array.from(event.clipboardData?.files || []);
          if(!files.length){if(/<img\b/i.test(event.clipboardData?.getData("text/html") || ""))setImageError("外链图片未插入。请复制实际图片，或使用“插入图片”上传；文字仍可正常粘贴。");return false;}
          event.preventDefault();uploadRef.current(files);return true;
        },
        handleDrop: (view,event,_slice,moved) => {
          const latex=event.dataTransfer?.getData(LATEX_DND_TYPE);
          if(latex && !moved){
            event.preventDefault();
            if(!provider.writable)return true;
            try {formulaHTML(latex);const pos=view.posAtCoords({left:event.clientX,top:event.clientY})?.pos;
              const node=view.state.schema.nodes.documentFormula.create({latex});
              view.dispatch(pos===undefined?view.state.tr.replaceSelectionWith(node):view.state.tr.insert(pos,node));setFormulaError("");
            } catch {setFormulaError("公式无效或过长，请修改 LaTeX 源码。");}
            return true;
          }
          if(moved || !event.dataTransfer?.files.length)return false;
          event.preventDefault();
          uploadRef.current(Array.from(event.dataTransfer.files),view.posAtCoords({left:event.clientX,top:event.clientY})?.pos);
          return true;
        },
        attributes: {
          class: "collab-editor",
          role: "textbox",
          "aria-label": "协作文档正文",
          "aria-multiline": "true",
        },
      },
      onSelectionUpdate: ({ editor: e }) => {
        const { from, to } = e.state.selection;
        const sync = ySyncPluginKey.getState(e.state);
        if (!sync?.binding) return;
        const a = to64(
            Y.encodeRelativePosition(
              absolutePositionToRelativePosition(
                from,
                sync.type,
                sync.binding.mapping,
              ),
            ),
          ),
          b = to64(
            Y.encodeRelativePosition(
              absolutePositionToRelativePosition(
                to,
                sync.type,
                sync.binding.mapping,
              ),
            ),
          );
        provider.selection({ anchor: a, head: b });
        onSelection(
          from === to
            ? null
            : {
                quote: e.state.doc.textBetween(from, to, " ").slice(0, 1000),
                anchor: { start: a, end: b },
              },
        );
      },
    },
    [provider],
  );
  uploadRef.current=(files,position)=>{
    if(!editor || !provider.writable || busy.current || !files.length)return;
    busy.current=true;setUploading(true);setImageError("");
    const sync=ySyncPluginKey.getState(editor.state);
    const bookmark=sync?.binding ? absolutePositionToRelativePosition(position ?? editor.state.selection.from,sync.type,sync.binding.mapping):null;
    void (async()=>{
      try {
        if(files.length>5)throw Error("一次最多插入 5 张图片。");
        const ids=[];
        for(const file of files){
          if(!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size>5*1024*1024)throw Error("请选择 5MB 以内的 PNG、JPEG 或 WebP 图片。");
          const bitmap=await createImageBitmap(file);
          const pixels=bitmap.width*bitmap.height;bitmap.close();
          if(pixels>40000000)throw Error("图片分辨率过大，请压缩到 4000 万像素以内。");
          const body=new FormData();body.append("file",file);
          const result=await api.post(`/documents/${provider.docId}/images`,body,{headers:{"x-organization-id":organizationId}});
          ids.push({type:"documentImage",attrs:{assetId:result.data.id,alt:file.name.slice(0,300),caption:"",width:100}});
        }
        if(!mounted.current || editor.isDestroyed)return;
        if(!provider.writable)throw Error("图片已上传，但文档已不可编辑，未插入正文。");
        const current=ySyncPluginKey.getState(editor.state);
        const at=bookmark && current?.binding ? relativePositionToAbsolutePosition(provider.doc,current.type,bookmark,current.binding.mapping):null;
        if(at===null)throw Error("插入位置已被删除，请重新选择位置。图片尚未插入正文。");
        editor.chain().focus().insertContentAt(at,[...ids,{type:"paragraph"}]).run();
      }catch(e:any){if(mounted.current)setImageError(e.response?.status===413?"图片过大或已达到文档图片额度（20张 / 20MB）。":e.response?.status===403?"当前没有上传图片的权限。":e.message || "图片上传失败，请重试。");}
      finally{busy.current=false;if(mounted.current)setUploading(false);}
    })();
  };
  useEffect(()=>{
    if(!editor)return;
    const update=()=>{
      render(n=>n+1);const attrs=editor.getAttributes("documentImage");
      if(attrs.assetId!==captionAsset.current){captionDirty.current=false;captionAsset.current=attrs.assetId || "";}
      if(!captionDirty.current && document.activeElement!==captionInput.current)setImageCaption(attrs.caption || "");
    };
    editor.on("transaction",update);
    return()=>{editor.off("transaction",update);};
  },[editor]);
  useEffect(
    () =>
      provider.subscribe(() => {
        editor?.setEditable(provider.writable);
        if (editor && !editor.isDestroyed)
          editor.view.dispatch(editor.state.tr);
        render((n) => n + 1);
      }),
    [provider, editor],
  );
  if (!editor) return <p>正在加载编辑器…</p>;
  const tools: [string, () => void][] = [
    ["粗体", () => editor.chain().focus().toggleBold().run()],
    ["斜体", () => editor.chain().focus().toggleItalic().run()],
    ["删除线", () => editor.chain().focus().toggleStrike().run()],
    ["标题", () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
    ["列表", () => editor.chain().focus().toggleBulletList().run()],
    ["有序列表", () => editor.chain().focus().toggleOrderedList().run()],
    ["任务", () => editor.chain().focus().toggleTaskList().run()],
    ["引用", () => editor.chain().focus().toggleBlockquote().run()],
    ["代码", () => editor.chain().focus().toggleCode().run()],
    ["代码块", () => editor.chain().focus().toggleCodeBlock().run()],
    ["分隔线", () => editor.chain().focus().setHorizontalRule().run()],
    ["清除格式", () => editor.chain().focus().unsetAllMarks().clearNodes().run()],
    [
      "链接",
      () => {
        setLink(editor.getAttributes("link").href || "https://");setLinkOpen(v=>!v);
      },
    ],
    ["撤销", () => editor.commands.undo()],
    ["重做", () => editor.commands.redo()],
  ];
  const active:Record<string,boolean>={"粗体":editor.isActive("bold"),"斜体":editor.isActive("italic"),"删除线":editor.isActive("strike"),"标题":editor.isActive("heading"),"列表":editor.isActive("bulletList"),"有序列表":editor.isActive("orderedList"),"任务":editor.isActive("taskList"),"引用":editor.isActive("blockquote"),"代码":editor.isActive("code"),"代码块":editor.isActive("codeBlock"),"链接":editor.isActive("link")};
  return (
    <>
      <div
        className="sticky top-0 z-20 flex flex-wrap gap-2 border-b bg-white p-3"
        role="toolbar"
        aria-label="正文格式"
      >
        <select aria-label="段落样式" className="rounded border px-2 py-1 text-sm" disabled={!provider.writable}
          value={editor.isActive("heading")?String(editor.getAttributes("heading").level):"0"}
          onChange={e=>{const level=Number(e.target.value);if(level)editor.chain().focus().setHeading({level:level as 1|2|3}).run();else editor.chain().focus().setParagraph().run();}}>
          <option value="0">正文</option><option value="1">一级标题</option><option value="2">二级标题</option><option value="3">三级标题</option>
        </select>
        {tools.map(([label, action]) => (
          <button
            key={label}
            type="button"
            className={`rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-40 ${active[label]?"bg-blue-100 text-blue-800":""}`}
            aria-pressed={active[label]}
            disabled={!provider.writable || (label==="撤销" && !editor.can().undo()) || (label==="重做" && !editor.can().redo())}
            onMouseDown={(e) => e.preventDefault()}
            onClick={action}
          >
            {label}
          </button>
        ))}
        <button type="button" disabled={!provider.writable || uploading} onMouseDown={e=>e.preventDefault()} onClick={()=>fileInput.current?.click()} className="rounded border px-3 py-1 text-sm disabled:opacity-40">{uploading?"正在上传图片…":"插入图片"}</button>
        <button type="button" disabled={!provider.writable} aria-expanded={formulaOpen} onMouseDown={e=>e.preventDefault()} onClick={()=>{setFormulaOpen(v=>!v);setLatex(editor.isActive("documentFormula")?editor.getAttributes("documentFormula").latex:"");setFormulaError("");}} className="rounded border px-3 py-1 text-sm">数学公式</button>
        <input ref={fileInput} aria-label="上传文档图片" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={e=>{uploadRef.current(Array.from(e.target.files || []));e.target.value="";}} />
      </div>
      {formulaOpen && <div className="space-y-3 border-b bg-slate-50 p-3">
        <FormulaPalette disabled={!provider.writable} onInsert={value=>{if(!provider.writable)return;try{formulaHTML(value);editor.chain().focus().insertContent({type:"documentFormula",attrs:{latex:value}}).run();setFormulaError("");}catch{setFormulaError("公式无效或过长。");}}} />
        <textarea aria-label="LaTeX 公式源码" maxLength={8000} disabled={!provider.writable} value={latex} onChange={e=>setLatex(e.target.value)} placeholder="输入 LaTeX，例如 \frac{a}{b}" className="w-full rounded border p-2 font-mono text-sm" />
        <button type="button" disabled={!provider.writable} className="rounded border bg-white px-3 py-1 text-sm" onClick={()=>{if(!provider.writable)return;try{formulaHTML(latex);if(editor.isActive("documentFormula"))editor.chain().focus().updateAttributes("documentFormula",{latex}).run();else editor.chain().focus().insertContent({type:"documentFormula",attrs:{latex}}).run();setFormulaError("");}catch{setFormulaError("公式无效或过长，请检查 LaTeX 源码。");}}}>插入 / 更新选中公式</button>
        <p className="text-xs text-slate-500">拖拽模板到正文指定位置，或点击模板插入；选中已有公式后打开此面板修改源码。支持 KaTeX 数学语法，无需 $ 分隔符。</p>
      </div>}
      {formulaError && <p role="alert" className="p-3 text-sm text-red-700">{formulaError}</p>}
      {linkOpen && <form className="flex flex-wrap gap-2 border-b bg-slate-50 p-3" onSubmit={e=>{e.preventDefault();try{const parsed=new URL(link);if(!["https:","http:"].includes(parsed.protocol))throw Error();editor.chain().focus().extendMarkRange("link").setLink({href:parsed.href}).run();setLinkOpen(false);setImageError("");}catch{setImageError("请输入有效的 HTTP / HTTPS 链接。");}}}>
        <input aria-label="链接地址" className="min-w-60 flex-1 rounded border p-2 text-sm" value={link} onChange={e=>setLink(e.target.value)} />
        <button disabled={!provider.writable} className="rounded border px-3 text-sm">应用链接</button>
        <button type="button" disabled={!provider.writable} onClick={()=>{editor.chain().focus().extendMarkRange("link").unsetLink().run();setLinkOpen(false);}} className="px-2 text-sm">移除链接</button>
        <button type="button" onClick={()=>setLinkOpen(false)} className="px-2 text-sm">取消</button>
      </form>}
      {editor.isActive("documentImage") && <div className="flex flex-wrap items-center gap-2 border-b bg-blue-50 p-3 text-sm">
        <input ref={captionInput} aria-label="图片说明" maxLength={1000} value={imageCaption} onChange={e=>{captionDirty.current=true;setImageCaption(e.target.value);}} className="min-w-48 flex-1 rounded border p-2" disabled={!provider.writable} />
        <button disabled={!provider.writable} onMouseDown={e=>e.preventDefault()} onClick={()=>{captionDirty.current=false;editor.chain().focus().updateAttributes("documentImage",{caption:imageCaption}).run();}}>保存图片说明</button>
        <select aria-label="图片宽度" value={editor.getAttributes("documentImage").width || 100} disabled={!provider.writable} onChange={e=>editor.chain().focus().updateAttributes("documentImage",{width:Number(e.target.value)}).run()}><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option></select>
        <button disabled={!provider.writable} onMouseDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().deleteSelection().run()} className="text-red-700">删除图片</button>
      </div>}
      {imageError && <p role="alert" className="border-b bg-red-50 p-3 text-sm text-red-700">{imageError}</p>}
      <div className="flex justify-between border-b bg-slate-50 px-4 py-2 text-xs text-slate-500"><span>直接输入正文；可粘贴或拖入图片，Markdown 输入快捷方式可用。</span><span aria-label="正文字数">{editor.getText().replace(/\s/g,"").length} 字</span></div>
      <EditorContent editor={editor} />
      <button
        type="button"
        className="m-4 text-sm text-blue-700"
        onClick={() => {
          const blob = new Blob([editor.getText()], {
              type: "text/plain;charset=utf-8",
            }),
            url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = "collabspace-draft.txt";
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        导出本地纯文本草稿
      </button>
    </>
  );
}
export default function DocumentEditor({
  docId,
  org,
  user,
  onReady,
  onSelection,
}: {
  docId: string;
  org: string;
  user: string;
  onReady: (p: DocumentProvider) => void;
  onSelection: (s: any) => void;
}) {
  const [provider, setProvider] = useState<DocumentProvider | null>(null),
    [error, setError] = useState("");
  const [, refresh] = useState(0);
  useEffect(() => {
    let alive = true;
    const p = new DocumentProvider(docId, org, user);
    const unsubscribe = p.subscribe(() => {
      if (alive) refresh((n) => n + 1);
    });
    p.init()
      .then(() => {
        if (alive) {
          setProvider(p);
          onReady(p);
        }
      })
      .catch(() => {
        if (alive) setError("无法打开本地存储。请检查浏览器存储权限后重试。");
      });
    return () => {
      alive = false;
      unsubscribe();
      void p.destroy();
    };
  }, [docId, org, user, onReady]);
  return error ? (
    <p role="alert" className="p-6 text-red-700">
      {error}
    </p>
  ) : provider?.ready ? (
    <RichEditor provider={provider} onSelection={onSelection} organizationId={org} />
  ) : (
    <p className="p-6">正在读取本地草稿…</p>
  );
}
