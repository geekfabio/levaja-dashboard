"use client";

import { useEffect, useRef } from "react";
import { useUiStore } from "@/stores/ui-store";
import { CREATE_COMMANDS, PAGES, PRIMARY_CREATE, useRunCommand } from "./use-commands";

const SEQUENCE_TIMEOUT = 1200;

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest("[role='listbox'], [role='menu']") !== null
  );
}

function overlayOpen() {
  return document.querySelector("[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open']") !== null;
}

export default function GlobalShortcuts() {
  const { pathname, go, create } = useRunCommand();
  const pendingG = useRef<number | null>(null);
  const handlers = useRef({ pathname, go, create });

  useEffect(() => {
    handlers.current = { pathname, go, create };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (key === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        const { paletteOpen, setPaletteOpen } = useUiStore.getState();
        setPaletteOpen(!paletteOpen);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isTyping(event.target) || overlayOpen()) return;

      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const page = PAGES.find((item) => item.shortcut.toLowerCase() === key);
        if (page) {
          event.preventDefault();
          handlers.current.go(page.href);
        }
        return;
      }

      if (key === "g") {
        pendingG.current = window.setTimeout(() => {
          pendingG.current = null;
        }, SEQUENCE_TIMEOUT);
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        useUiStore.getState().setHelpOpen(true);
        return;
      }

      if (key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-page-search]");
        if (search) {
          event.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }

      if (key === "n") {
        const command = CREATE_COMMANDS.find(
          (item) => item.id === PRIMARY_CREATE[handlers.current.pathname],
        );
        if (command) {
          event.preventDefault();
          handlers.current.create(command);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
