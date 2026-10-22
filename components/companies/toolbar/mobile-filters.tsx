"use client";

import { useState } from "react";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import Field from "@/components/_ui/field";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import {
  ACTIVITY_OPTIONS,
  OWNER_OPTIONS,
  SORT_MENU_OPTIONS,
  STAGE_OPTIONS,
} from "./filter-options";
import { ownerByName, type SortKey } from "@/data/companies";
import { ALL_OWNERS, activeFilterCount } from "@/lib/companies";
import { useCompanyFilters, useVisibleCompanies } from "../use-visible-companies";
import { cn } from "@/lib/utils";
import { useCompaniesStore } from "@/stores/companies-store";
import FilterIcon from "@/public/assets/images/_common/filter.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

type MobileFiltersProps = {
  className?: string;
};

export default function MobileFilters({ className }: MobileFiltersProps) {
  const [open, setOpen] = useState(false);
  const sortBy = useCompaniesStore((state) => state.sortBy);
  const owner = useCompaniesStore((state) => state.owner);
  const stage = useCompaniesStore((state) => state.stage);
  const activityWindow = useCompaniesStore((state) => state.activityWindow);
  const setSortBy = useCompaniesStore((state) => state.setSortBy);
  const setOwner = useCompaniesStore((state) => state.setOwner);
  const setStage = useCompaniesStore((state) => state.setStage);
  const setActivityWindow = useCompaniesStore(
    (state) => state.setActivityWindow,
  );
  const resetFilters = useCompaniesStore((state) => state.resetFilters);

  const filters = useCompanyFilters();
  const activeCount = activeFilterCount(filters);
  const resultCount = useVisibleCompanies().length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={
          activeCount > 0
            ? `Filtros, ${activeCount} ativo(s)`
            : "Filtros"
        }
        className={cn("data-[active=true]:bg-muted", className)}
        data-active={activeCount > 0}
      >
        <FilterIcon aria-hidden className="size-3" />
        Filtros
        {activeCount > 0 && <CountBadge>{activeCount}</CountBadge>}
      </Button>

      <SheetContent side="bottom">
        <SheetHeader className="px-4">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription className="sr-only">
            Ordenar e filtrar a tabela de clientes
          </SheetDescription>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-1"
              aria-label="Fechar filtros"
            >
              <XIcon aria-hidden className="text-foreground size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>

        <ScrollArea viewportClassName="max-h-[calc(85dvh-118px)]">
          <div className="flex flex-col gap-4 p-4">
            <Field label="Ordenar por" htmlFor="mobile-sort">
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortKey)}
              >
                <SelectTrigger id="mobile-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_MENU_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Gestor de conta" htmlFor="mobile-owner">
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger id="mobile-owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value === ALL_OWNERS ? (
                        option.label
                      ) : (
                        <span className="flex items-center gap-2">
                          <Avatar
                            src={ownerByName(option.value).avatar}
                            alt=""
                          />
                          {option.label}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Fase" htmlFor="mobile-stage">
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger id="mobile-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Última atividade" htmlFor="mobile-activity">
              <Select
                value={String(activityWindow)}
                onValueChange={(value) => setActivityWindow(Number(value))}
              >
                <SelectTrigger id="mobile-activity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </ScrollArea>

        <SheetFooter className="px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            disabled={activeCount === 0 && sortBy === "pipelineValue"}
            className="-ml-1.5"
          >
            Repor
          </Button>
          <SheetClose asChild>
            <Button variant="primary" size="sm">
              Ver {resultCount}{" "}
              {resultCount === 1 ? "cliente" : "clientes"}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
