import { create } from "zustand";
import { repositories } from "@/data/leva-ja";
import { applyRolePermissions } from "@/lib/leva-ja/permissions";
import type { AdminSession, RolePermissions } from "@/types/leva-ja";

type SessionStatus = "loading" | "authenticated" | "anonymous";

type AdminSessionState = {
  status: SessionStatus;
  session: AdminSession | null;
  expired: boolean;
  load: () => Promise<void>;
  login: (email: string, code: string) => Promise<AdminSession>;
  logout: () => Promise<void>;
  expire: () => void;
  setRolePermissions: (matrix: RolePermissions) => void;
};

export const useAdminSessionStore = create<AdminSessionState>((set, get) => ({
  status: "loading",
  session: null,
  expired: false,

  load: async () => {
    try {
      const session = await repositories().auth.currentSession();
      applyRolePermissions(session?.rolePermissions);
      set({ session, status: session ? "authenticated" : "anonymous" });
    } catch {
      if (!get().session) set({ status: "anonymous" });
    }
  },

  login: async (email, code) => {
    const session = await repositories().auth.login(email, code);
    applyRolePermissions(session.rolePermissions);
    set({ session, status: "authenticated", expired: false });
    return session;
  },

  logout: async () => {
    try {
      await repositories().auth.logout();
    } finally {
      applyRolePermissions(undefined);
      set({ session: null, status: "anonymous", expired: false });
    }
  },

  setRolePermissions: (matrix) => {
    applyRolePermissions(matrix);
    const session = get().session;
    if (session) set({ session: { ...session, rolePermissions: matrix } });
  },

  expire: () => {
    if (get().status !== "authenticated") return;
    set({ session: null, status: "anonymous", expired: true });
  },
}));

export function useAdminRole() {
  return useAdminSessionStore((state) => state.session?.user.role ?? null);
}
