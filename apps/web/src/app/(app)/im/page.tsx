"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useImStore } from "@/store/im";
import { useImRealtime } from "@/lib/use-im-realtime";
import { api } from "@/lib/api";
import ConversationList from "@/components/im/ConversationList";
import ChatWindow from "@/components/im/ChatWindow";
import NewConversationModal from "@/components/im/NewConversationModal";

function ImContent() {
  const searchParams = useSearchParams();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const { setConversations, setCurrentConversationId, currentConversationId } = useImStore();
  const [showNewModal, setShowNewModal] = useState(false);

  useImRealtime();

  useEffect(() => {
    const c = searchParams.get("c");
    if (c) setCurrentConversationId(c);
  }, [searchParams, setCurrentConversationId]);

  useEffect(() => {
    if (!currentOrgId) return;
    api
      .get("/conversations")
      .then((res) => setConversations(res.data))
      .catch(() => setConversations([]));
  }, [currentOrgId, setConversations]);

  if (!currentOrgId) return null;

  return (
    <div className="page-enter flex h-[calc(100vh-64px)]">
      <div
        className={`w-full shrink-0 flex-col border-r border-slate-300 bg-[var(--paper-sunk)] md:flex md:w-[340px] ${
          currentConversationId ? "hidden" : "flex"
        }`}
      >
        <div className="border-b border-slate-300 px-5 py-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Inbox</p>
              <h1 className="display-title mt-1.5 text-3xl text-slate-900">消息</h1>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-600"
            >
              发起聊天
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            单聊、群聊与文件消息。选择会话开始。
          </p>
        </div>
        <ConversationList />
      </div>
      <div
        className={`min-w-0 flex-1 flex-col bg-[var(--paper-raised)] md:flex ${
          currentConversationId ? "flex" : "hidden"
        }`}
      >
        <ChatWindow />
      </div>
      {showNewModal && <NewConversationModal onClose={() => setShowNewModal(false)} />}
    </div>
  );
}

export default function ImPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm">加载中…</div>}>
      <ImContent />
    </Suspense>
  );
}
