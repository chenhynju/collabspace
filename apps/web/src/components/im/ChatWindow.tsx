'use client';
import { useEffect, useRef } from 'react';
import { useImStore } from '@/store/im';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import { PersonaPanel } from '@/components/personas/PersonaPanel';

export default function ChatWindow() {
  const currentConversationId = useImStore((s) => s.currentConversationId);
  const messages = useImStore((s) => s.messages);
  const setMessages = useImStore((s) => s.setMessages);
  const conversations = useImStore((s) => s.conversations);
  const typingUsers = useImStore((s) => s.typingUsers);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conv = conversations.find((c) => c.id === currentConversationId);
  const typing = (currentConversationId ? (typingUsers[currentConversationId] ?? []) : []).filter(
    (user) => user.userId !== currentUserId,
  );

  useEffect(() => {
    if (!currentConversationId || !currentOrgId) return;
    let active = true;
    setMessages([]);
    api.get(`/conversations/${currentConversationId}/messages?limit=50`)
      .then((res) => {
        if (!active) return;
        setMessages(res.data);
        const latest = res.data[res.data.length - 1];
        if (latest) {
          useImStore.getState().resetUnread(currentConversationId);
          void api.post(`/conversations/${currentConversationId}/read`, {
            lastReadMessageId: latest.id,
          }).catch(() => {});
        }
      })
      .catch(() => { if (active) setMessages([]); });
    return () => { active = false; };
  }, [currentConversationId, currentOrgId, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conv) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        选择一个会话开始聊天
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-3 border-b border-slate-200 bg-white">
        <h2 className="font-semibold text-slate-800">{conv.title || '未命名会话'}</h2>
        <div aria-live="polite" className="min-h-5 text-xs text-indigo-600">
          {typing.length ? `${typing.map((user) => user.userName).join('、')} 正在输入…` : ''}
        </div>
        <PersonaPanel/>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageComposer key={`${currentOrgId}:${conv.id}`} conversationId={conv.id} />
    </>
  );
}

