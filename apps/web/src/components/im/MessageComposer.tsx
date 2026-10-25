'use client';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { useImStore } from '@/store/im';
import { VoiceTools } from '@/components/voice/VoiceTools';
import { useAuthStore } from '@/store/auth';
import {Disclosure} from '@/components/disclosure';
import {DictationInput} from '@/components/voice/DictationInput';
import {ArrowUp,ImagePlus,Paperclip,Volume2} from 'lucide-react';

export default function MessageComposer({ conversationId }: { conversationId: string }) {
  const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const current=()=>alive.current&&useAuthStore.getState().currentOrgId===org&&useAuthStore.getState().user?.id===user&&useImStore.getState().currentConversationId===conversationId;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [dictationBusy,setDictationBusy]=useState(false),[legacyBusy,setLegacyBusy]=useState(false);
  const inputRef=useRef<HTMLTextAreaElement>(null);
  const focusAfterDictation=useRef(false);
  useEffect(()=>{const input=inputRef.current;if(input){input.style.height='auto';input.style.height=Math.min(160,input.scrollHeight)+'px';}},[text]);
  useEffect(()=>{if(focusAfterDictation.current&&!dictationBusy){focusAfterDictation.current=false;inputRef.current?.focus();}},[dictationBusy,text]);
  const acceptTranscript=(value:string)=>{focusAfterDictation.current=true;setText(current=>current?`${current.trimEnd()}\n${value}`:value);};
  const sendingRef = useRef(false);
  const appendMessage = useImStore((s) => s.appendMessage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const voiceIntent=useRef<{file:File;hash:string;content:string;requestId:string;attachmentId?:string}|null>(null);

  const sendText = async () => {
    if (!text.trim() || sendingRef.current||dictationBusy||legacyBusy) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await api.post(`/conversations/${conversationId}/messages`, {
        type: 'TEXT',
        content: text.trim(),
      });
      if(!current())return;
      appendMessage(res.data);
      setText('');
    } catch (e) {
      console.error('send failed', e);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey&&!e.nativeEvent.isComposing) {
      e.preventDefault();
      sendText();
    }
  };

  const uploadAndSend = async (file: File, type: 'IMAGE' | 'FILE') => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const attRes = await api.post(`/conversations/${conversationId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if(!current())return;
      const msgRes = await api.post(`/conversations/${conversationId}/messages`, {
        type,
        content: file.name,
        attachmentId: attRes.data.id,
      });
      if(!current())return;
      appendMessage(msgRes.data);
    } catch (e) {
      console.error('upload failed', e);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="border-t border-slate-100 bg-white p-3 sm:p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-100">
      <textarea ref={inputRef} value={text} disabled={sending||dictationBusy} onChange={e=>setText(e.target.value)} onKeyDown={handleKeyDown} placeholder="输入消息..." aria-label="消息正文" rows={1} className="max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-base leading-6 outline-none disabled:opacity-60 sm:text-sm"/>
      <div className="flex items-start gap-1">
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={sending||dictationBusy||legacyBusy} aria-label="发送图片" title="添加图片" className="rounded-full p-2.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <ImagePlus size={18}/>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sending||dictationBusy||legacyBusy} aria-label="发送文件" title="添加文件" className="rounded-full p-2.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <Paperclip size={18}/>
        </button>
        <DictationInput conversationId={conversationId} active={!sending&&!legacyBusy} onTranscript={acceptTranscript} onBusyChange={setDictationBusy}/>
        <button
          onClick={sendText}
          aria-label="发送" title="发送消息" disabled={sending ||dictationBusy||legacyBusy|| !text.trim()}
          className="rounded-full bg-slate-900 p-2.5 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <ArrowUp size={18}/>
        </button>
      </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-slate-400"><span>语音输入转成文字，检查后再发送</span><span className="hidden sm:inline">Enter 发送 · Shift + Enter 换行</span></div>
      <Disclosure className="mt-2" title={<><Volume2 size={14}/>语音选项</>}><div><VoiceTools scope={{conversationId}} text={text} active={!dictationBusy&&!sending} onBusyChange={setLegacyBusy} onTranscript={acceptTranscript} onSendAudio={async file=>{
        if(sendingRef.current)throw Error('消息正在发送');
        sendingRef.current=true;setSending(true);
        try{
          const content=text.trim()||'语音消息';
          const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');
          if(!current())throw Error('会话已切换，已停止发送');
          if(!voiceIntent.current||voiceIntent.current.content!==content||voiceIntent.current.hash!==hash)voiceIntent.current={file,hash,content,requestId:crypto.randomUUID()};
          const intent=voiceIntent.current;
          if(!intent.attachmentId){const form=new FormData();form.append('file',intent.file);const attachment=await api.post(`/conversations/${conversationId}/attachments`,form);intent.attachmentId=attachment.data.id;}
          if(!current())throw Error('会话已切换，已停止发送');
          const response=await api.post(`/conversations/${conversationId}/messages`,{type:'FILE',content:intent.content,attachmentId:intent.attachmentId,requestId:intent.requestId});
          if(!current())return;
          voiceIntent.current=null;
          appendMessage(response.data);setText('');
        }finally{sendingRef.current=false;setSending(false);}
      }}/></div></Disclosure>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadAndSend(f, 'IMAGE');
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadAndSend(f, 'FILE');
          e.target.value = '';
        }}
      />
    </div>
  );
}

