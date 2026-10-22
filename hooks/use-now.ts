"use client";

import { useSyncExternalStore } from "react";

const TICK = 30 * 1000;
const listeners = new Set<() => void>();
let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  current = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    current = Date.now();
    timer = setInterval(tick, TICK);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  return current || (current = Date.now());
}

function getServerSnapshot() {
  return null;
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
