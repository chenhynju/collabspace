"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useImStore } from "@/store/im";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";

export default function ChatWindow() {
  const currentConversationId = useImStore((s) => s.currentConversationId);
  const setCurrentConversationId = useImStore((s) => s.setCurrentConversationId);
  const messages = useImStore((s) => s.messages);
  const setMessages = useImStore((s) => s.setMessages);
  const conversations = useImStore((s) => s.conversations);
  const typingUsers = useImStore((s) => s.typingUsers);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conv = conversations.find((c) => c.id === currentConversationId);
  const typing = (currentConversationId ? (typingUsers[currentConversationId] ?? []) : []).filter(
    (user) => user.userId !== currentUserId,
  );

  // Group header shows who is in the room; direct chats already show the peer name.
  useEffect(() => {
    if (!currentConversationId || conv?.type !== "GROUP") {
      setMemberNames([]);
      return;
    }
    const controller = new AbortController();
    api
      .get(`/conversations/${currentConversationId}`, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const names = (res.data?.members ?? [])
          .map((member: any) => member.user?.name)
          .filter((name: unknown): name is string => typeof name === "string" && !!name);
        setMemberNames(names);
      })
      .catch(() => {
        if (!controller.signal.aborted) setMemberNames([]);
      });
    return () => controller.abort();
  }, [currentConversationId, conv?.type]);

  useEffect(() => {
    if (!currentConversationId || !currentOrgId) return;
    let active = true;
    setMessages([]);
    api
      .get(`/conversations/${currentConversationId}/messages?limit=50`)
      .then((res) => {
        if (!active) return;
        setMessages(res.data);
        const latest = res.data[res.data.length - 1];
        if (latest) {
          useImStore.getState().resetUnread(currentConversationId);
          void api
            .post(`/conversations/${currentConversationId}/read`, {
              lastReadMessageId: latest.id,
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (active) setMessages([]);
      });
    return () => {
      active = false;
    };
  }, [currentConversationId, currentOrgId, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conv) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--paper)] px-6 text-center">
        <span className="mb-4 block h-px w-12 bg-indigo-600" />
        <p className="display-title text-2xl text-slate-700">选择一个会话</p>
        <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
          左侧列表里是单聊与群聊。发起聊天后，消息会实时同步给成员。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-slate-300 bg-[var(--paper-raised)] px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => {
            setCurrentConversationId(null);
            window.history.replaceState(null, "", "/im");
          }}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-700 md:hidden"
        >
          <ArrowLeft size={13} /> 返回会话
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{conv.type === "GROUP" ? "Group thread" : "Direct message"}</p>
            <h2 className="display-title mt-1.5 truncate text-2xl text-slate-900">
              {conv.title || "未命名会话"}
            </h2>
          </div>
          <Link
            href="/settings/persona"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] text-slate-500 transition hover:border-slate-900 hover:text-slate-900"
          >
            <Settings2 size={12} /> 语音与数字分身
          </Link>
        </div>
        {conv.type === "GROUP" && (
          <p className="mt-2 truncate text-xs text-slate-500" title={memberNames.join("、")}>
            {memberNames.length
              ? `群成员：${memberNames.slice(0, 8).join("、")}${memberNames.length > 8 ? ` 等 ${memberNames.length} 人` : ""}`
              : "正在读取群成员…"}
          </p>
        )}
        <div aria-live="polite" className="min-h-4 text-xs text-indigo-700">
          {typing.length
            ? `${typing.map((user) => user.userName).join("、")} 正在输入…`
            : ""}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[var(--paper)] px-4 py-6 sm:px-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageComposer key={`${currentOrgId}:${conv.id}`} conversationId={conv.id} />
    </>
  );
}
