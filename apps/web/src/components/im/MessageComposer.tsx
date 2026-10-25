﻿﻿﻿﻿﻿﻿'use client';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { useImStore } from '@/store/im';
import { VoiceTools } from '@/components/voice/VoiceTools';
import { useAuthStore } from '@/store/auth';

export default function MessageComposer({ conversationId }: { conversationId: string }) {
  const org=useAuthStore(s=>s.currentOrgId),user=useAuthStore(s=>s.user?.id),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const current=()=>alive.current&&useAuthStore.getState().currentOrgId===org&&useAuthStore.getState().user?.id===user&&useImStore.getState().currentConversationId===conversationId;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const appendMessage = useImStore((s) => s.appendMessage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const voiceIntent=useRef<{file:File;hash:string;content:string;requestId:string;attachmentId?:string}|null>(null);

  const sendText = async () => {
    if (!text.trim() || sendingRef.current) return;
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
    <div className="p-3 border-t border-slate-200 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => imageInputRef.current?.click()}
          className="text-sm text-slate-500 hover:text-blue-600"
        >
          🖼️ 图片
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-sm text-slate-500 hover:text-blue-600"
        >
          📎 文件
        </button>
      </div>
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          className="flex-1 min-h-[40px] max-h-[120px] px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={1}
        />
        <button
          onClick={sendText}
          disabled={sending || !text.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          发送
        </button>
      </div>
      <VoiceTools scope={{conversationId}} text={text} onTranscript={value=>setText(value)} onSendAudio={async file=>{
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
      }}/>
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

