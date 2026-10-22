"use client";

import { useState } from "react";

export function useEditable<T extends object>() {
  const [initial, setInitial] = useState<T | null>(null);
  const [draft, setDraft] = useState<T | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const editing = draft !== null;
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(initial);

  function start(values: T) {
    setInitial(values);
    setDraft(values);
    setConfirmingClose(false);
  }

  function reset() {
    setInitial(null);
    setDraft(null);
    setConfirmingClose(false);
  }

  function update<K extends keyof T>(key: K, value: T[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setConfirmingClose(false);
  }

  function requestClose(close: () => void) {
    if (dirty) {
      setConfirmingClose(true);
      return;
    }
    reset();
    close();
  }

  return { draft, editing, dirty, confirmingClose, start, reset, update, requestClose };
}
