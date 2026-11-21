"use client";
import { useImStore } from "@/store/im";
import { useAuthStore } from "@/store/auth";

interface Props {
  conversation: ReturnType<typeof useImStore.getState>["conversations"][0];
}

export default function ConversationItem({ conversation }: Props) {
  const currentConversationId = useImStore((s) => s.currentConversationId);
  const setCurrentConversationId = useImStore((s) => s.setCurrentConversationId);
  const resetUnread = useImStore((s) => s.resetUnread);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

  const isActive = currentConversationId === conversation.id;

  const handleClick = () => {
    setCurrentConversationId(conversation.id);
    resetUnread(conversation.id);
    window.history.replaceState(null, "", `?c=${conversation.id}`);
  };

  const preview = conversation.lastMessage
    ? conversation.lastMessage.type === "TEXT"
      ? conversation.lastMessage.content.slice(0, 60)
      : conversation.lastMessage.type === "IMAGE"
        ? "[图片]"
        : "[文件]"
    : "开始聊天";
  const senderName =
    conversation.lastMessage?.senderName || conversation.lastMessage?.sender?.name || "";
  const shownPreview =
    conversation.type === "GROUP" && senderName ? `${senderName}：${preview}` : preview;

  return (
    <button
      onClick={handleClick}
      className={`relative flex w-full items-center gap-3 border-b border-slate-200/70 px-4 py-3.5 text-left transition-colors ${
        isActive ? "bg-white" : "hover:bg-white/60"
      }`}
    >
      {isActive ? <span className="absolute inset-y-2 left-0 w-[2px] bg-indigo-600" /> : null}
      <div className="relative">
        <div
          className={`grid h-10 w-10 place-items-center rounded-sm text-sm font-semibold ${
            isActive
              ? "bg-slate-900 text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          {(conversation.title || "群").slice(0, 1)}
        </div>
        {conversation.unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm ${
              isActive ? "font-semibold text-slate-900" : "font-medium text-slate-800"
            }`}
          >
            {conversation.title || "未命名会话"}
          </span>
          {conversation.lastMessage && (
            <span className="shrink-0 font-mono text-[10px] text-slate-400">
              {new Date(conversation.lastMessage.createdAt).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500">{shownPreview}</div>
      </div>
    </button>
  );
}
