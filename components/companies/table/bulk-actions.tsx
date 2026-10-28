"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Button from "@/components/_ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { OWNERS, type Company } from "@/data/companies";
import { TODAY, companiesCsvRows } from "@/lib/companies";
import { downloadCsv } from "@/lib/csv";
import { ease } from "@/lib/easings";
import { useCompaniesStore } from "@/stores/companies-store";
import { useArchiveCompanies, useUpdateManyCompanies } from "@/hooks/crm/use-companies";
import { useSettingsStore } from "@/stores/settings-store";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

export default function BulkActions({ selected }: { selected: Company[] }) {
  const zones = useSettingsStore((state) => state.zones);
  const setSelected = useCompaniesStore((state) => state.setSelected);
  const updateMany = useUpdateManyCompanies();
  const archiveCompanies = useArchiveCompanies();
  const reduceMotion = useReducedMotion();
  const ids = selected.map((company) => company.id);

  return (
    <AnimatePresence initial={false}>
      {selected.length > 0 && (
        <motion.div
          role="toolbar"
          aria-label="Ações para os clientes selecionados"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: 0.2, ease: ease.power3Out }}
          className="bg-popover pointer-events-auto absolute inset-x-4 bottom-16 z-20 mx-auto flex max-w-max flex-wrap items-center gap-1 rounded-xl p-1.5 shadow-[0px_12px_32px_-8px_rgba(0,0,0,0.6),0px_0px_0px_1px_var(--muted)]"
        >
          <span className="caption-style text-foreground px-2 tabular-nums">
            {selected.length === 1 ? "1 selecionado" : `${selected.length} selecionados`}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                Atribuir gestor
                <ChevronIcon aria-hidden className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[50dvh] overflow-y-auto">
              <DropdownMenuLabel>Gestor de conta</DropdownMenuLabel>
              {OWNERS.map((owner) => (
                <DropdownMenuItem key={owner.name} onSelect={() => updateMany.mutate({ ids, patch: { owner: owner.name }, snapshot: selected })}>
                  {owner.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                Mudar zona
                <ChevronIcon aria-hidden className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Zona</DropdownMenuLabel>
              {zones.map((zone) => (
                <DropdownMenuItem key={zone.name} onSelect={() => updateMany.mutate({ ids, patch: { zone: zone.name }, snapshot: selected })}>
                  {zone.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadCsv(`clientes-selecionados-${TODAY}.csv`, companiesCsvRows(selected))}
          >
            Exportar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => archiveCompanies.mutate({ ids, snapshot: selected })}>
            Arquivar
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Limpar seleção" onClick={() => setSelected([])}>
            <XIcon aria-hidden className="size-3.5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
