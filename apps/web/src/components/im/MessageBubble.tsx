"use client";
import { Paperclip } from "lucide-react";
import { Disclosure } from "@/components/disclosure";
import { useAuthStore } from "@/store/auth";
import type { Message } from "@/store/im";
import { useImStore } from "@/store/im";
import { PrivateAudio, VoiceTools } from "@/components/voice/VoiceTools";

const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1").replace(
  "/api/v1",
  "",
);

export default function MessageBubble({ message }: { message: Message }) {
  const me = useAuthStore((s) => s.user);
  const conversationId = useImStore((s) => s.currentConversationId);
  const conversation = useImStore((s) =>
    s.conversations.find((item) => item.id === s.currentConversationId),
  );
  const isMe = message.senderId === me?.id;
  const senderName = message.senderName || message.sender?.name || "";
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

  return (
    <div className={`mb-5 flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
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
              ? "rounded-lg rounded-tr-none bg-slate-900 text-[#fffdf7]"
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
        {message.type === "TEXT" && conversationId && (
          <Disclosure title="朗读消息" className="mt-1 text-slate-600" unmountOnClose>
            <VoiceTools scope={{ conversationId }} text={message.content} />
          </Disclosure>
        )}
        <span className="mt-1 font-mono text-[10px] text-slate-400">
          {readLabel ? (
            <span data-read-label className="mr-1">
              {readLabel} ·{" "}
            </span>
          ) : null}
          {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
