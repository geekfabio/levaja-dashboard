"use client";

import { useEffect, useRef } from "react";
import { useNow } from "@/hooks/use-now";
import { nowLuandaLocal } from "@/lib/format";
import { useNotificationsStore } from "@/stores/notifications-store";
import { useFollowUps } from "./use-follow-ups";

export default function FollowUpNotifier() {
  const { items } = useFollowUps();
  const now = useNow();
  const announced = useRef(false);

  useEffect(() => {
    if (now === null || announced.current) return;
    announced.current = true;
    const overdue = items.filter((item) => item.bucket === "atrasado").length;
    const today = items.filter((item) => item.bucket === "hoje").length;
    if (overdue + today === 0) return;
    useNotificationsStore.getState().push({
      id: `follow-up-${nowLuandaLocal().slice(0, 10)}`,
      kind: "alert",
      message: `Follow-up: ${overdue} em atraso e ${today} para hoje.`,
      at: nowLuandaLocal(),
      href: "/follow-up",
      unread: true,
    });
  }, [items, now]);

  return null;
}
