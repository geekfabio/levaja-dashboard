import { create } from "zustand";

export type ToastTone = "neutral" | "success" | "danger";

export type ToastAction = {
  label: string;
  run: () => void;
};

export type Toast = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: ToastAction;
};

export type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: ToastTone };

const MAX_TOASTS = 3;

type ToastState = {
  toasts: Toast[];
  show: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (input) => {
    const id = `toast-${crypto.randomUUID().slice(0, 8)}`;
    const next: Toast = { ...input, tone: input.tone ?? "neutral", id };
    set((state) => ({ toasts: [...state.toasts, next].slice(-MAX_TOASTS) }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function toast(input: ToastInput) {
  return useToastStore.getState().show(input);
}
