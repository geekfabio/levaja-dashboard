"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Button from "@/components/_ui/button";
import { ease } from "@/lib/easings";
import { useToastStore, type Toast } from "@/stores/toast-store";
import AlertIcon from "@/public/assets/images/companies/sidebar/alert-triangle.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

const AUTO_DISMISS_MS = 5000;

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(AUTO_DISMISS_MS);
  const persistent = Boolean(toast.action) || toast.tone === "danger";

  useEffect(() => {
    if (persistent || paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => dismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [dismiss, paused, persistent, toast.id]);

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="bg-popover pointer-events-auto flex items-start gap-3 rounded-xl p-3 pl-3.5 shadow-[0px_12px_32px_-8px_rgba(0,0,0,0.6),0px_0px_0px_1px_var(--muted),inset_0px_1px_0px_0px_rgba(255,255,255,0.06)]"
    >
      {toast.tone === "danger" && <AlertIcon aria-hidden className="text-danger mt-px size-4 shrink-0" />}
      {toast.tone === "success" && (
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-(--tag-green-text)" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="lead-style font-medium">{toast.title}</span>
        {toast.description && (
          <span className="caption-style text-subtle">{toast.description}</span>
        )}
      </div>
      {toast.action && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            toast.action?.run();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Fechar aviso"
        onClick={() => dismiss(toast.id)}
        className="-mr-1"
      >
        <XIcon aria-hidden className="size-3.5" />
      </Button>
    </div>
  );
}

export default function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-label="Avisos"
      aria-live="polite"
      data-toaster
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-stretch gap-2 sm:left-auto sm:w-[380px]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout={!reduceMotion}
            role="status"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.22, ease: ease.power3Out }}
          >
            <ToastCard toast={item} />
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
}
