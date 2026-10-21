"use client";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {MermaidPreview} from '../boards/MermaidPreview';
export function MarkdownPreview({source}:{source:string}){
  return <article aria-label="Markdown 安全预览" className="collab-editor min-w-0 flex-1 overflow-auto rounded border bg-white p-5">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
      code({className,children}){return className==='language-mermaid'?<MermaidPreview source={String(children).replace(/\n$/,'')}/>:<code className={className}>{children}</code>;},
      img({alt}){return <span className="text-sm text-slate-500">[图片：{alt||'外部资源未加载'}]</span>;},
      a({href,children}){return <a href={href?.startsWith('https://')||href?.startsWith('http://')||href?.startsWith('#')?href:undefined} target="_blank" rel="noopener noreferrer">{children}</a>;},
    }}>{source}</ReactMarkdown>
  </article>;
}
