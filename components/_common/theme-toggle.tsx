"use client";

import type { MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { flushSync } from "react-dom";
import Button from "@/components/_ui/button";
import { applyTheme, useTheme } from "@/hooks/use-theme";
import type { Theme } from "@/lib/theme";
import SunIcon from "@/public/assets/images/_common/header/sun.svg";
import MoonIcon from "@/public/assets/images/_common/header/moon.svg";

const REVEAL_EASE = "cubic-bezier(0.76, 0, 0.24, 1)";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

export function switchTheme(next: Theme, origin?: { x: number; y: number }, reduceMotion = false) {
  const doc = document as ViewTransitionDocument;
  if (!doc.startViewTransition || reduceMotion) {
    applyTheme(next);
    return;
  }
  const x = origin?.x ?? window.innerWidth - 40;
  const y = origin?.y ?? 28;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = doc.startViewTransition(() => {
    flushSync(() => applyTheme(next));
  });
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 550, easing: REVEAL_EASE, pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {});
}

export default function ThemeToggle() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion() ?? false;
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? "Mudar para tema claro" : "Mudar para tema escuro";

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    switchTheme(next, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, reduceMotion);
  }

  return (
    <Button variant="secondary" size="icon" aria-label={label} title={label} onClick={onClick} className="relative overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.4, y: 8 }}
          animate={{ opacity: 1, rotate: 0, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.4, y: -8 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center"
        >
          {theme === "dark" ? <MoonIcon aria-hidden className="size-3.5" /> : <SunIcon aria-hidden className="size-3.5" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
