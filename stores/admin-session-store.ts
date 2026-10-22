import { create } from "zustand";
import { repositories } from "@/data/leva-ja";
import type { AdminSession } from "@/types/leva-ja";

type SessionStatus = "loading" | "authenticated" | "anonymous";

type AdminSessionState = {
  status: SessionStatus;
  session: AdminSession | null;
  expired: boolean;
  load: () => Promise<void>;
  login: (email: string, code: string) => Promise<AdminSession>;
  logout: () => Promise<void>;
  expire: () => void;
};

export const useAdminSessionStore = create<AdminSessionState>((set, get) => ({
  status: "loading",
  session: null,
  expired: false,

  load: async () => {
    try {
      const session = await repositories().auth.currentSession();
      set({ session, status: session ? "authenticated" : "anonymous" });
    } catch {
      if (!get().session) set({ status: "anonymous" });
    }
  },

  login: async (email, code) => {
    const session = await repositories().auth.login(email, code);
    set({ session, status: "authenticated", expired: false });
    return session;
  },

  logout: async () => {
    try {
      await repositories().auth.logout();
    } finally {
      set({ session: null, status: "anonymous", expired: false });
    }
  },

  expire: () => {
    if (get().status !== "authenticated") return;
    set({ session: null, status: "anonymous", expired: true });
  },
}));

export function useAdminRole() {
  return useAdminSessionStore((state) => state.session?.user.role ?? null);
}
