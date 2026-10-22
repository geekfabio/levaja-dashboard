"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}

function getServerSnapshot() {
  return "⌘";
}

export function useModifierKey() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
