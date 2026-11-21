"use client";
import { create } from "zustand";

export interface ConversationItem {
  id: string;
  type: "DIRECT" | "GROUP";
  title?: string | null;
  avatarUrl?: string | null;
  peerUserId?: string | null;
  lastMessage?: {
    id: string;
    type: string;
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  myRole: "OWNER" | "MEMBER";
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  sender?: { id: string; name: string; avatarUrl: string | null } | null;
  type: "TEXT" | "IMAGE" | "FILE";
  content: string;
  attachment?: { id: string; name: string; mimeType: string; size: string } | null;
  createdAt: string;
  readBy?: string[];
}

export interface TypingUser {
  userId: string;
  userName: string;
}

interface ImState {
  conversations: ConversationItem[];
  currentConversationId: string | null;
  messages: Message[];
  typingUsers: Record<string, TypingUser[]>;
  setConversations: (convs: ConversationItem[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  setMessages: (msgs: Message[]) => void;
  appendMessage: (msg: Message) => void;
  updateConversationPreview: (conversationId: string, lastMessage: Message) => void;
  incrementUnread: (conversationId: string) => void;
  resetUnread: (conversationId: string) => void;
  markRead: (conversationId: string, userId: string, readAt: string) => void;
  setTyping: (conversationId: string, user: TypingUser, typing: boolean) => void;
  clearTyping: () => void;
}

export const useImStore = create<ImState>((set) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  typingUsers: {},
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversationId: (currentConversationId) => set({ currentConversationId }),
  setMessages: (messages) => set({ messages }),
  // The POST response and the realtime echo describe the same durable message.
  // Deduplicate by server ID, never by content (identical messages are valid).
  appendMessage: (msg) =>
    set((s) => (s.messages.some((m) => m.id === msg.id) ? s : { messages: [...s.messages, msg] })),
  updateConversationPreview: (conversationId, lastMessage) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessage, unreadCount: c.unreadCount } : c,
      ),
    })),
  incrementUnread: (conversationId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c,
      ),
    })),
  resetUnread: (conversationId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    })),
  markRead: (conversationId, userId, readAt) =>
    set((s) => {
      if (s.currentConversationId !== conversationId) return s;
      const readTime = Date.parse(readAt);
      if (!Number.isFinite(readTime)) return s;
      return {
        messages: s.messages.map((message) => {
          if (
            message.senderId === userId ||
            Date.parse(message.createdAt) > readTime ||
            message.readBy?.includes(userId)
          )
            return message;
          return { ...message, readBy: [...(message.readBy ?? []), userId] };
        }),
      };
    }),
  setTyping: (conversationId, user, typing) =>
    set((s) => {
      const current = s.typingUsers[conversationId] ?? [];
      const others = current.filter((item) => item.userId !== user.userId);
      return {
        typingUsers: {
          ...s.typingUsers,
          [conversationId]: typing ? [...others, user] : others,
        },
      };
    }),
  clearTyping: () => set({ typingUsers: {} }),
}));
