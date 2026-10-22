"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useOnline } from "@/hooks/use-online";
import { plural } from "@/lib/format";
import { useFieldStore } from "@/stores/field-store";

export default function ConnectionStatus() {
  const online = useOnline();
  const queued = useFieldStore((state) => state.queue.length);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    useFieldStore.getState().restore();
  }, []);

  useEffect(() => {
    if (online) useFieldStore.getState().flush();
  }, [online]);

  return (
    <AnimatePresence initial={false}>
      {!online && (
        <motion.div
          role="status"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          className="caption-style fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-2"
        >
          <span className="rounded-full border border-(--tag-amber-border) bg-(--tag-amber-bg) px-3 py-1.5 text-(--tag-amber-text) shadow-overlay">
            Sem rede — os registos ficam guardados neste dispositivo
            {queued > 0 && ` (${plural(queued, "por enviar", "por enviar")})`} e são enviados quando a rede voltar.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
