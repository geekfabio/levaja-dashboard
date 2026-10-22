import { create } from "zustand";
import {
  AUDIT_EVENTS,
  type AuditChange,
  type AuditEvent,
  type EntityRef,
} from "@/data/audit";
import { CURRENT_USER } from "@/data/companies";
import type { NotificationKind } from "@/data/notifications";
import { nowLuandaLocal } from "@/lib/format";
import { useNotificationsStore } from "./notifications-store";
import { toast, type ToastInput } from "./toast-store";

type AuditState = {
  events: AuditEvent[];
  append: (event: AuditEvent) => void;
};

export const useAuditStore = create<AuditState>((set) => ({
  events: AUDIT_EVENTS,
  append: (event) => set((state) => ({ events: [event, ...state.events] })),
}));

export type RecordEventInput = {
  action: string;
  target: EntityRef;
  changes?: AuditChange[];
  sensitive?: boolean;
  companyId?: string;
  notify?: NotificationKind | false;
  toast?: ToastInput;
};

export function recordEvent({
  action,
  target,
  changes = [],
  sensitive = false,
  companyId,
  notify = "update",
  toast: toastInput,
}: RecordEventInput) {
  const at = nowLuandaLocal();
  const id = crypto.randomUUID().slice(0, 8);

  useAuditStore.getState().append({
    id: `au-${id}`,
    at,
    actor: CURRENT_USER.name,
    action,
    target,
    changes,
    sensitive,
  });

  if (notify) {
    useNotificationsStore.getState().push({
      id: `n-${id}`,
      kind: notify,
      actor: CURRENT_USER.name,
      companyId,
      message: `${action} ${target.label}`,
      at,
      target,
      unread: true,
    });
  }

  if (toastInput) toast(toastInput);
}
