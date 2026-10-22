"use client";

import { useMemo, useState } from "react";
import TotalsBar from "@/components/_common/totals/totals-bar";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import Button from "@/components/_ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import { OFFER_STATUS_TONES, type OfferStatus } from "@/data/discount-offers";
import { useToday } from "@/hooks/use-today";
import { isOfferOpen, offerScopeLabel, offerStatus } from "@/lib/automation-engine";
import {
  formatDateShort,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
  plural,
} from "@/lib/format";
import { useAutomationRunsStore } from "@/stores/automation-runs-store";
import { useCompaniesStore } from "@/stores/companies-store";
import ChevronIcon from "@/public/assets/images/_common/chevron-down.svg";

type Filter = "abertas" | "Aproveitada" | "fechadas" | null;

export default function OffersList() {
  const offers = useAutomationRunsStore((state) => state.offers);
  const setOfferStatus = useAutomationRunsStore((state) => state.setOfferStatus);
  const companies = useCompaniesStore((state) => state.companies);
  const openTarget = useOpenTarget();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>(null);

  const rows = useMemo(
    () =>
      offers
        .map((offer) => ({
          offer,
          status: offerStatus(offer, today),
          company: companies.find((company) => company.id === offer.companyId),
        }))
        .sort((a, b) => b.offer.createdAt.localeCompare(a.offer.createdAt)),
    [offers, companies, today],
  );

  const open = rows.filter((row) => isOfferOpen(row.offer, today));
  const used = rows.filter((row) => row.status === "Aproveitada");
  const closed = rows.filter((row) => !isOfferOpen(row.offer, today) && row.status !== "Substituída");
  const usedRate = closed.length ? Math.round((used.length / closed.length) * 100) : 0;
  const salesValue = used.reduce((sum, row) => sum + (row.offer.saleTotal ?? 0), 0);
  const discountValue = used.reduce((sum, row) => sum + (row.offer.discountValue ?? 0), 0);

  const visible = rows.filter((row) => {
    if (filter === "abertas") return isOfferOpen(row.offer, today);
    if (filter === "Aproveitada") return row.status === "Aproveitada";
    if (filter === "fechadas") return !isOfferOpen(row.offer, today);
    return true;
  });

  const toggle = (value: Filter) => () => setFilter(filter === value ? null : value);

  return (
    <>
      <TotalsBar
        id="automacoes-propostas"
        summary={`${plural(open.length, "proposta aberta", "propostas abertas")} · ${formatMoneyCompact(salesValue)} em vendas com desconto`}
        items={[
          {
            key: "abertas",
            label: "Por apresentar ou apresentadas",
            value: formatNumber(open.length),
            hint: "à espera de compra",
            tone: open.length > 0 ? "warning" : undefined,
            pressed: filter === "abertas",
            onSelect: toggle("abertas"),
          },
          {
            key: "aproveitadas",
            label: "Aproveitadas",
            value: formatNumber(used.length),
            hint: closed.length ? `${usedRate}% das propostas fechadas` : undefined,
            tone: used.length > 0 ? "success" : undefined,
            pressed: filter === "Aproveitada",
            onSelect: toggle("Aproveitada"),
          },
          {
            key: "fechadas",
            label: "Fechadas",
            value: formatNumber(rows.length - open.length),
            hint: "aproveitadas, recusadas, expiradas ou substituídas",
            pressed: filter === "fechadas",
            onSelect: toggle("fechadas"),
          },
          {
            key: "vendas",
            label: "Vendas com desconto",
            value: formatMoneyCompact(salesValue),
            fullValue: formatMoney(salesValue),
            hint: `${formatMoneyCompact(discountValue)} de desconto concedido`,
          },
        ]}
      />

      <ScrollArea orientation="both" className="min-h-0 flex-1">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Criada</TableHead>
              <TableHead>Válida até</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(({ offer, status, company }) => (
              <TableRow key={offer.id}>
                <TableCell className="max-w-[240px]">
                  <span className="flex min-w-0 flex-col gap-1">
                    <Button
                      variant="link"
                      size="none"
                      className="justify-start truncate font-medium no-underline"
                      onClick={() =>
                        openTarget({ module: "Clientes", id: offer.companyId, label: company?.name ?? offer.companyId })
                      }
                    >
                      {company?.name ?? offer.companyId}
                    </Button>
                    <span className="caption-style text-subtle truncate">
                      {offer.automationId ? "Automação" : "Manual"} · {offer.owner}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="max-w-[220px]">
                  <span className="flex min-w-0 flex-col gap-1" title={offerScopeLabel(offer)}>
                    <span className="font-medium tabular-nums">{formatPercent(offer.percent)}</span>
                    <span className="caption-style text-subtle truncate">{offerScopeLabel(offer)}</span>
                  </span>
                </TableCell>
                <TableCell className="text-soft tabular-nums">
                  <span className="flex flex-col gap-1">
                    {formatDateShort(offer.createdAt.slice(0, 10))}
                    {offer.daysWithoutPurchase !== undefined && (
                      <span className="caption-style text-subtle">{offer.daysWithoutPurchase} dias sem comprar</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-soft tabular-nums">{formatDateShort(offer.validUntil)}</TableCell>
                <TableCell>
                  <Tag tone={OFFER_STATUS_TONES[status as OfferStatus]}>{status}</Tag>
                </TableCell>
                <TableCell className="tabular-nums">
                  {status === "Aproveitada" ? (
                    <span className="flex flex-col gap-1">
                      <span>{formatMoney(offer.saleTotal ?? 0)}</span>
                      <span className="caption-style text-subtle">
                        {offer.saleDocument} · −{formatMoney(offer.discountValue ?? 0)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isOfferOpen(offer, today) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="subtle" size="sm">
                          Registar
                          <ChevronIcon aria-hidden className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={offer.status === "Apresentada"}
                          onSelect={() => setOfferStatus(offer.id, "Apresentada")}
                        >
                          Apresentada ao cliente
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setOfferStatus(offer.id, "Recusada")}>
                          Cliente recusou
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="caption-style text-subtle py-10 text-center">
                  Sem propostas de desconto para este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </>
  );
}
