"use client";

import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import FilterMenu from "@/components/_common/filter-menu";
import { ASSIGNEE_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "./filter-options";
import { useTicketsStore } from "@/stores/tickets-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import MailIcon from "@/public/assets/images/companies/sidebar/mail.svg";

export default function TicketsToolbar() {
  const status = useTicketsStore((state) => state.status);
  const priority = useTicketsStore((state) => state.priority);
  const assignee = useTicketsStore((state) => state.assignee);
  const search = useTicketsStore((state) => state.search);
  const setStatus = useTicketsStore((state) => state.setStatus);
  const setPriority = useTicketsStore((state) => state.setPriority);
  const setAssignee = useTicketsStore((state) => state.setAssignee);
  const setSearch = useTicketsStore((state) => state.setSearch);
  const setNewTicketOpen = useTicketsStore((state) => state.setNewTicketOpen);
  const setFromEmailOpen = useTicketsStore((state) => state.setFromEmailOpen);

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label="Pesquisar tickets"
          data-page-search
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar assunto ou cliente…"
          className="h-[30px] w-full sm:w-[220px]"
        />
        <FilterMenu
          label="Estado"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
        />
        <FilterMenu
          label="Prioridade"
          value={priority}
          options={PRIORITY_OPTIONS}
          onChange={setPriority}
        />
        <FilterMenu
          label="Responsável"
          value={assignee}
          options={ASSIGNEE_OPTIONS}
          onChange={setAssignee}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setFromEmailOpen(true)}
        >
          <MailIcon aria-hidden className="size-3" />
          Criar a partir de E-mail
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setNewTicketOpen(true)}
        >
          <PlusIcon aria-hidden className="size-3" />
          Novo Ticket
        </Button>
      </div>
    </div>
  );
}
