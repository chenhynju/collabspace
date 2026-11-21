"use client";
import { useState } from "react";
import { Paperclip, Volume2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import type { Message } from "@/store/im";
import { useImStore } from "@/store/im";
import { PrivateAudio } from "@/components/voice/VoiceTools";

const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1").replace(
  "/api/v1",
  "",
);

export default function MessageBubble({ message }: { message: Message }) {
  const me = useAuthStore((s) => s.user);
  const conversation = useImStore((s) =>
    s.conversations.find((item) => item.id === s.currentConversationId),
  );
  const isMe = message.senderId === me?.id;
  const senderName = message.senderName || message.sender?.name || "";
  const [speaking, setSpeaking] = useState(false);
  const readBy = message.readBy ?? [];
  const readLabel = !isMe
    ? ""
    : conversation?.type === "DIRECT"
      ? conversation.peerUserId && readBy.includes(conversation.peerUserId)
        ? "已读"
        : "未读"
      : readBy.length
        ? `${readBy.length} 人已读`
        : "未读";

  const toggleSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = "zh-CN";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`group mb-5 flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-slate-300 text-[11px] font-semibold text-slate-700">
        {(senderName || "?").slice(0, 1)}
      </div>
      <div className={`flex max-w-[72%] flex-col ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && (
          <span className="mb-1 text-[11px] font-medium text-slate-500">
            {senderName || "未知用户"}
          </span>
        )}
        <div
          className={`px-3.5 py-2.5 text-sm leading-6 ${
            isMe
              ? "rounded-lg rounded-tr-none bg-slate-900 text-[var(--paper-raised)]"
              : "rounded-lg rounded-tl-none border border-slate-200 bg-white text-slate-800"
          }`}
        >
          {message.type === "TEXT" && <div className="whitespace-pre-wrap">{message.content}</div>}
          {message.type === "IMAGE" && message.attachment && (
            <img
              src={`${apiBase}/messages/attachments/${message.attachment.id}/download`}
              alt={message.attachment.name}
              className="max-h-[240px] max-w-[240px] rounded-sm"
            />
          )}
          {message.type === "FILE" && message.attachment?.mimeType === "audio/wav" && (
            <>
              <PrivateAudio attachmentId={message.attachment.id} />
              <div className="whitespace-pre-wrap">{message.content}</div>
            </>
          )}
          {message.type === "FILE" &&
            message.attachment &&
            message.attachment.mimeType !== "audio/wav" && (
              <a
                href={`${apiBase}/messages/attachments/${message.attachment.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 underline"
              >
                <Paperclip size={13} />
                <span className="max-w-[200px] truncate">{message.attachment.name}</span>
              </a>
            )}
        </div>
        <span className="mt-1 flex items-center gap-1 font-mono text-[10px] text-slate-400">
          {readLabel ? (
            <span data-read-label className="mr-1">
              {readLabel} ·{" "}
            </span>
          ) : null}
          {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {message.type === "TEXT" ? (
            <button
              type="button"
              onClick={toggleSpeech}
              aria-label={speaking ? "停止朗读这条消息" : "朗读这条消息"}
              title={speaking ? "停止系统朗读" : "系统朗读"}
              className={`ml-1 rounded-sm p-0.5 opacity-0 transition hover:bg-slate-200/60 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100 ${
                speaking ? "text-indigo-700 opacity-100" : ""
              }`}
            >
              <Volume2 size={11} />
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
