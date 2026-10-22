"use client";

import { useId, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { ease } from "@/lib/easings";
import { cn } from "@/lib/utils";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

export type TotalItem = {
  key: string;
  label: string;
  value: string;
  fullValue?: string;
  hint?: string;
  tone?: "warning" | "danger" | "success";
  pressed?: boolean;
  onSelect?: () => void;
};

type TotalsBarProps = {
  id: string;
  items: TotalItem[];
  summary: string;
};

const STORAGE_PREFIX = "totais-";

const memory = new Map<string, boolean>();

function readHidden(id: string) {
  if (memory.has(id)) return memory.get(id)!;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + id) === "ocultos";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeHidden(id: string, hidden: boolean) {
  memory.set(id, hidden);
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, hidden ? "ocultos" : "visiveis");
  } catch {}
  listeners.forEach((listener) => listener());
}

const TONE_DOT = {
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-(--tag-green-text)",
} as const;

function TileContent({ item }: { item: TotalItem }) {
  return (
    <>
      <span className="caption-style text-subtle flex min-w-0 items-center gap-1.5">
        {item.tone && (
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[item.tone])} />
        )}
        <span className="truncate">{item.label}</span>
      </span>
      <span
        title={item.fullValue}
        className="max-w-full truncate text-[18px] leading-none font-medium tabular-nums sm:text-[20px]"
      >
        {item.value}
        {item.fullValue && <span className="sr-only"> ({item.fullValue})</span>}
      </span>
      {item.hint && <span className="caption-style text-faint hidden max-w-full truncate sm:block">{item.hint}</span>}
    </>
  );
}

const PANEL_VARIANTS: Variants = {
  closed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.32, ease: ease.power3InOut, delay: 0.06 },
      opacity: { duration: 0.2, ease: ease.power2Out, delay: 0.12 },
      staggerChildren: 0.025,
      staggerDirection: -1,
    },
  },
  open: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { duration: 0.42, ease: ease.power4Out },
      opacity: { duration: 0.2, ease: ease.power2Out },
      delayChildren: 0.06,
      staggerChildren: 0.045,
    },
  },
};

const TILE_VARIANTS: Variants = {
  closed: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    filter: "blur(2px)",
    transition: { duration: 0.16, ease: ease.power2In },
  },
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.36, ease: ease.power4Out },
  },
};

const REDUCED_PANEL: Variants = {
  closed: { opacity: 0, height: 0, transition: { duration: 0.2 } },
  open: { opacity: 1, height: "auto", transition: { duration: 0.2 } },
};

const REDUCED_TILE: Variants = {
  closed: { opacity: 1 },
  open: { opacity: 1 },
};

const TILE_CLASS =
  "flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-[background-color,border-color] duration-150 ease-power3-out";

export default function TotalsBar({ id, items, summary }: TotalsBarProps) {
  const hidden = useSyncExternalStore(
    subscribe,
    () => readHidden(id),
    () => false,
  );
  const reduceMotion = useReducedMotion();
  const regionId = useId();

  function toggle() {
    writeHidden(id, !hidden);
  }

  return (
    <section aria-label="Totais" className="shrink-0 px-4 pt-3">
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={!hidden}
          aria-controls={regionId}
          onClick={toggle}
          className="caption-style text-subtle hover:text-soft focus-visible:ring-ring/60 -mx-1.5 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none transition-colors duration-150 focus-visible:ring-2"
        >
          <motion.span
            aria-hidden
            className="flex shrink-0"
            initial={false}
            animate={{ rotate: hidden ? -90 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: ease.power3Out }}
          >
            <ChevronIcon className="size-3" />
          </motion.span>
          <span className="eyebrow-style shrink-0">Totais</span>
          <AnimatePresence initial={false} mode="popLayout">
            {hidden && (
              <motion.span
                key="summary"
                className="text-soft min-w-0 truncate"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, filter: "blur(2px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -4, filter: "blur(2px)" }}
                transition={{ duration: 0.28, ease: ease.power3Out, delay: reduceMotion ? 0 : 0.12 }}
              >
                · {summary}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-faint relative ml-auto grid shrink-0 pl-2">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={hidden ? "mostrar" : "ocultar"}
                className="col-start-1 row-start-1 text-right"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: hidden ? 6 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: hidden ? -6 : 6 }}
                transition={{ duration: 0.22, ease: ease.power3Out }}
              >
                {hidden ? "Mostrar" : "Ocultar"}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!hidden && (
          <motion.div
            id={regionId}
            key="totals"
            variants={reduceMotion ? REDUCED_PANEL : PANEL_VARIANTS}
            initial="closed"
            animate="open"
            exit="closed"
            className="-mx-1 overflow-hidden px-1"
          >
            <ul className="grid grid-cols-2 gap-2 pt-2 pb-1.5 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
              {items.map((item) => (
                <motion.li
                  key={item.key}
                  variants={reduceMotion ? REDUCED_TILE : TILE_VARIANTS}
                  className="flex min-w-0 origin-top"
                >
                  {item.onSelect ? (
                    <button
                      type="button"
                      aria-pressed={item.pressed}
                      onClick={item.onSelect}
                      className={cn(
                        TILE_CLASS,
                        "focus-visible:ring-ring/60 w-full cursor-pointer outline-none focus-visible:ring-2 motion-safe:active:scale-[0.98]",
                        item.pressed ? "border-foreground/40 bg-white/5" : "border-border bg-tile shadow-tile hover:bg-white/3",
                      )}
                    >
                      <TileContent item={item} />
                    </button>
                  ) : (
                    <div className={cn(TILE_CLASS, "border-border bg-tile shadow-tile w-full")}>
                      <TileContent item={item} />
                    </div>
                  )}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
