"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/_ui/popover";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import NotificationItem from "./notification-item";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import type { Notification } from "@/data/notifications";
import { useNow } from "@/hooks/use-now";
import { useCompaniesStore } from "@/stores/companies-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import BellIcon from "@/public/assets/images/companies/header/bell.svg";

type Filter = "all" | "unread";

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const navigated = useRef(false);
  const companies = useCompaniesStore((state) => state.companies);
  const notifications = useNotificationsStore((state) => state.notifications);
  const markRead = useNotificationsStore((state) => state.markRead);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const openTarget = useOpenTarget();
  const router = useRouter();
  const now = useNow();

  const unreadCount = notifications.filter((item) => item.unread).length;
  const visible = notifications.filter((item) => filter === "all" || item.unread);

  function handleSelect(notification: Notification) {
    markRead(notification.id);
    if (notification.href) {
      navigated.current = true;
      setOpen(false);
      router.push(notification.href);
      return;
    }
    if (!notification.target) return;
    navigated.current = true;
    setOpen(false);
    openTarget(notification.target);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label={
            unreadCount > 0
              ? `Notificações, ${unreadCount} não lidas`
              : "Notificações"
          }
          className="data-[state=open]:bg-muted relative"
        >
          <BellIcon aria-hidden className="size-3.5" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="bg-danger ring-secondary absolute top-[7px] right-[7px] size-1.5 rounded-full ring-2"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(400px,calc(100vw-2rem))]"
        onCloseAutoFocus={(event) => {
          if (navigated.current) event.preventDefault();
          navigated.current = false;
        }}
      >
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <h2>Notificações</h2>
            {unreadCount > 0 && <CountBadge>{unreadCount}</CountBadge>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={unreadCount === 0}
            onClick={markAllRead}
            className="-mr-1.5"
          >
            Marcar todas como lidas
          </Button>
        </div>

        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as Filter)}
        >
          <TabsList className="border-line-strong border-b px-4">
            <TabsTrigger value="all" className="py-3">
              Todas
            </TabsTrigger>
            <TabsTrigger value="unread" className="py-3">
              Não lidas
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {visible.length > 0 ? (
          <ScrollArea viewportClassName="max-h-[min(420px,60dvh)]">
            <ul className="flex flex-col gap-0.5 p-1.5">
              {visible.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  company={companies.find(
                    (company) => company.id === notification.companyId,
                  )}
                  now={now}
                  onSelect={() => handleSelect(notification)}
                />
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="bg-muted flex size-10 items-center justify-center rounded-full shadow-[0px_0px_0px_1px_var(--border)]">
              <BellIcon aria-hidden className="text-soft size-4" />
            </span>
            <span className="lead-style mt-1 block font-medium">
              Está tudo em dia
            </span>
            <span className="caption-style text-subtle block">
              Menções e alterações feitas pela equipa aparecem aqui.
            </span>
          </div>
        )}

        <div className="border-line-strong border-t p-1.5">
          <Button
            variant="ghost"
            size="sm"
            href="/auditoria"
            className="w-full"
            onClick={() => {
              navigated.current = true;
              setOpen(false);
            }}
          >
            Ver registo de auditoria
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
