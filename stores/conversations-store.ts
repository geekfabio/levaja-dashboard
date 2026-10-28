import { create } from "zustand";
import { CONVERSATIONS, type Conversation } from "@/data/conversations";

type ConversationsState = {
  conversations: Conversation[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
};

export const useConversationsStore = create<ConversationsState>((set) => ({
  conversations: CONVERSATIONS,
  activeId: null,
  setActiveId: (activeId) => set({ activeId }),
}));
