import { create } from "zustand";
import { NOTIFICATIONS, type Notification } from "@/data/notifications";

type NotificationsState = {
  notifications: Notification[];
  push: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: NOTIFICATIONS,
  push: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, unread: false } : item,
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, unread: false })),
    })),
}));
