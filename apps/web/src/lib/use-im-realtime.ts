"use client";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth";
import { useImStore } from "@/store/im";
import { api } from "@/lib/api";

const socketOrigin =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:3001";

let sharedSocket: Socket | null = null;
let socketRefCount = 0;

function getSocket(token: string): Socket {
  if (!sharedSocket) {
    sharedSocket = io(socketOrigin, {
      auth: { token },
      transports: ["websocket"],
    });
  }
  return sharedSocket;
}

function releaseSocket() {
  socketRefCount--;
  if (socketRefCount <= 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    socketRefCount = 0;
  }
}

export function emitImTyping(conversationId: string, typing: boolean) {
  const organizationId = useAuthStore.getState().currentOrgId;
  if (!organizationId || !sharedSocket?.connected) return;
  sharedSocket.emit("im:typing", { organizationId, conversationId, typing });
}

export function useImRealtime() {
  const token = useAuthStore((s) => s.token);
  const currentConversationId = useImStore((s) => s.currentConversationId);
  const appendMessage = useImStore((s) => s.appendMessage);
  const updateConversationPreview = useImStore((s) => s.updateConversationPreview);
  const incrementUnread = useImStore((s) => s.incrementUnread);
  const setConversations = useImStore((s) => s.setConversations);
  const markRead = useImStore((s) => s.markRead);
  const setTyping = useImStore((s) => s.setTyping);
  const clearTyping = useImStore((s) => s.clearTyping);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const currentRef = useRef(currentConversationId);
  currentRef.current = currentConversationId;

  useEffect(() => {
    if (!token || !currentOrgId) return;
    const socket = getSocket(token);
    socketRefCount++;
    let active = true;
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const onMessageNew = (data: {
      conversationId: string;
      message: {
        id: string;
        senderId: string;
        senderName: string;
        type: "TEXT" | "IMAGE" | "FILE";
        content: string;
        attachment: { id: string; name: string; mimeType: string; size: string } | null;
        createdAt: string;
      };
    }) => {
      const { conversationId, message } = data;
      const typingKey = `${conversationId}:${message.senderId}`;
      const typingTimer = typingTimers.get(typingKey);
      if (typingTimer) clearTimeout(typingTimer);
      typingTimers.delete(typingKey);
      setTyping(conversationId, { userId: message.senderId, userName: message.senderName }, false);
      if (
        !active ||
        useAuthStore.getState().currentOrgId !== currentOrgId ||
        !useImStore.getState().conversations.some((c) => c.id === conversationId)
      )
        return;
      if (currentRef.current === conversationId) {
        appendMessage(message);
        // 标记已读
        api
          .post(`/conversations/${conversationId}/read`, { lastReadMessageId: message.id })
          .catch(() => {});
      } else {
        incrementUnread(conversationId);
      }
      updateConversationPreview(conversationId, message);
    };

    const onConversationUpdated = () => {
      if (!active || useAuthStore.getState().currentOrgId !== currentOrgId) return;
      // 刷新会话列表
      api
        .get("/conversations")
        .then((res) => {
          if (active && useAuthStore.getState().currentOrgId === currentOrgId)
            setConversations(res.data);
        })
        .catch(() => {});
    };

    const onRead = (data: {
      organizationId: string;
      conversationId: string;
      userId: string;
      readAt: string;
    }) => {
      if (!active || data.organizationId !== currentOrgId) return;
      markRead(data.conversationId, data.userId, data.readAt);
    };

    const onTyping = (data: {
      organizationId: string;
      conversationId: string;
      userId: string;
      userName: string;
      typing: boolean;
    }) => {
      if (
        !active ||
        data.organizationId !== currentOrgId ||
        data.userId === useAuthStore.getState().user?.id
      )
        return;
      const key = `${data.conversationId}:${data.userId}`;
      const previous = typingTimers.get(key);
      if (previous) clearTimeout(previous);
      typingTimers.delete(key);
      setTyping(data.conversationId, { userId: data.userId, userName: data.userName }, data.typing);
      if (data.typing)
        typingTimers.set(
          key,
          setTimeout(() => {
            typingTimers.delete(key);
            setTyping(
              data.conversationId,
              { userId: data.userId, userName: data.userName },
              false,
            );
          }, 4000),
        );
    };

    socket.on("im:message:new", onMessageNew);
    socket.on("im:conversation:updated", onConversationUpdated);
    socket.on("im:read", onRead);
    socket.on("im:typing", onTyping);

    return () => {
      active = false;
      for (const timer of typingTimers.values()) clearTimeout(timer);
      typingTimers.clear();
      clearTyping();
      socket.off("im:message:new", onMessageNew);
      socket.off("im:conversation:updated", onConversationUpdated);
      socket.off("im:read", onRead);
      socket.off("im:typing", onTyping);
      releaseSocket();
    };
  }, [
    token,
    currentOrgId,
    appendMessage,
    incrementUnread,
    updateConversationPreview,
    setConversations,
    markRead,
    setTyping,
    clearTyping,
  ]);
}
