"use client";

import { useMemo, useState } from "react";
import ModuleHeader from "@/components/_common/module-header";
import FilterMenu from "@/components/_common/filter-menu";
import TotalsBar from "@/components/_common/totals/totals-bar";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import Tag from "@/components/_ui/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import { PAYMENT_METHODS, PAYMENT_TONES, SALE_CHANNELS } from "@/data/sales";
import { useToday } from "@/hooks/use-today";
import { downloadCsv } from "@/lib/csv";
import {
  formatDateTimeShort,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  plural,
} from "@/lib/format";
import { salesCsvRows, salesInWindow } from "@/lib/sales";
import { useCompaniesStore } from "@/stores/companies-store";
import { useSalesStore } from "@/stores/sales-store";
import PlusIcon from "@/public/assets/images/_common/plus.svg";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";

const ANY = "all";
type View = "todas" | "por-associar" | "em-divida";

const PAYMENT_OPTIONS = [
  { value: ANY, label: "Todos os pagamentos" },
  ...PAYMENT_METHODS.map((method) => ({ value: method, label: method })),
];
const CHANNEL_OPTIONS = [
  { value: ANY, label: "Todos os canais" },
  ...SALE_CHANNELS.map((channel) => ({ value: channel, label: channel })),
];

export default function Sales() {
  const sales = useSalesStore((state) => state.sales);
  const simulate = useSalesStore((state) => state.simulate);
  const markPaid = useSalesStore((state) => state.markPaid);
  const setAssociateId = useSalesStore((state) => state.setAssociateId);
  const companies = useCompaniesStore((state) => state.companies);
  const openTarget = useOpenTarget();
  const today = useToday();
  const [view, setView] = useState<View>("todas");
  const search = useSalesStore((state) => state.search);
  const setSearch = useSalesStore((state) => state.setSearch);
  const [payment, setPayment] = useState<string>(ANY);
  const [channel, setChannel] = useState<string>(ANY);

  const names = useMemo(() => new Map(companies.map((company) => [company.id, company.name])), [companies]);
  const companyName = (id?: string) => (id ? (names.get(id) ?? "—") : "Por associar");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (view === "por-associar" && sale.companyId) return false;
      if (view === "em-divida" && (sale.payment !== "Crédito" || sale.paid)) return false;
      if (payment !== ANY && sale.payment !== payment) return false;
      if (channel !== ANY && sale.channel !== channel) return false;
      if (!query) return true;
      return [sale.document, names.get(sale.companyId ?? "") ?? "", sale.identifier?.value ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [sales, view, payment, channel, search, names]);

  const unmatched = sales.filter((sale) => !sale.companyId).length;
  const debt = sales.filter((sale) => sale.payment === "Crédito" && !sale.paid);
  const todaySales = salesInWindow(visible, 1, today);
  const month = salesInWindow(visible, 30, today);
  const monthVolume = month.reduce((sum, sale) => sum + sale.total, 0);
  const debtTotal = debt.reduce((sum, sale) => sum + sale.total, 0);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ModuleHeader title="Vendas" count={visible.length}>
        <Tabs value={view} onValueChange={(value) => setView(value as View)}>
          <TabsList className="border-border overflow-x-auto border-b px-4 *:whitespace-nowrap">
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="por-associar">Por associar · {unmatched}</TabsTrigger>
            <TabsTrigger value="em-divida">Em dívida · {debt.length}</TabsTrigger>
          </TabsList>
        </Tabs>
      </ModuleHeader>

      <TotalsBar
        id="vendas"
        summary={`${plural(todaySales.length, "venda hoje", "vendas hoje")} · ${formatMoneyCompact(monthVolume)} em 30 dias`}
        items={[
          {
            key: "hoje",
            label: "Vendas hoje",
            value: formatNumber(todaySales.length),
            hint: formatMoney(todaySales.reduce((sum, sale) => sum + sale.total, 0)),
          },
          { key: "mes", label: "Volume 30 dias", value: formatMoneyCompact(monthVolume), fullValue: formatMoney(monthVolume) },
          {
            key: "ticket",
            label: "Ticket médio",
            value: month.length ? formatMoneyCompact(monthVolume / month.length) : "—",
            hint: plural(month.length, "documento", "documentos"),
          },
          {
            key: "associar",
            label: "Por associar",
            value: formatNumber(unmatched),
            hint: "compras sem cliente",
            tone: unmatched ? "warning" : undefined,
            pressed: view === "por-associar",
            onSelect: () => setView(view === "por-associar" ? "todas" : "por-associar"),
          },
          {
            key: "divida",
            label: "Em dívida",
            value: formatMoneyCompact(debtTotal),
            fullValue: formatMoney(debtTotal),
            hint: plural(debt.length, "documento a crédito", "documentos a crédito"),
            tone: debt.length ? "danger" : undefined,
            pressed: view === "em-divida",
            onSelect: () => setView(view === "em-divida" ? "todas" : "em-divida"),
          },
        ]}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Input
            type="search"
            aria-label="Pesquisar vendas"
            data-page-search
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Documento, cliente ou NIF…"
            className="h-[30px] w-full sm:w-[240px]"
          />
          <FilterMenu label="Pagamento" value={payment} options={PAYMENT_OPTIONS} onChange={setPayment} />
          <FilterMenu label="Canal" value={channel} options={CHANNEL_OPTIONS} onChange={setChannel} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadCsv(`vendas-${today}.csv`, salesCsvRows(visible, companyName))}
          >
            <ShareIcon aria-hidden className="size-3" />
            Exportar
          </Button>
          <Button variant="primary" size="sm" onClick={() => simulate(true)}>
            <PlusIcon aria-hidden className="size-3" />
            Simular compra
          </Button>
        </div>
      </div>

      <ScrollArea orientation="both" className="min-h-0 flex-1">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.slice(0, 200).map((sale) => {
              const inDebt = sale.payment === "Crédito" && !sale.paid;
              return (
                <TableRow key={sale.id}>
                  <TableCell>
                    <span className="flex flex-col gap-1">
                      <span className="font-medium tabular-nums">{sale.document}</span>
                      <span className="caption-style text-subtle">
                        {sale.identifier ? `${sale.identifier.type}: ${sale.identifier.value}` : "Sem identificação"}
                        {sale.source === "Simulação" ? " · simulação" : ""}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-soft tabular-nums">{formatDateTimeShort(sale.at)}</TableCell>
                  <TableCell>
                    {sale.companyId ? (
                      <Button
                        variant="link"
                        size="none"
                        className="no-underline"
                        onClick={() =>
                          openTarget({ module: "Clientes", id: sale.companyId, label: companyName(sale.companyId) })
                        }
                      >
                        {companyName(sale.companyId)}
                      </Button>
                    ) : (
                      <Tag tone="amber" size="sm">
                        Por associar
                      </Tag>
                    )}
                  </TableCell>
                  <TableCell className="text-soft">{sale.channel}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <Tag tone={PAYMENT_TONES[sale.payment]} size="sm">
                        {sale.payment}
                      </Tag>
                      {inDebt && (
                        <Tag tone="red" size="sm">
                          Em dívida
                        </Tag>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(sale.total)}</TableCell>
                  <TableCell className="text-right">
                    {!sale.companyId ? (
                      <Button variant="secondary" size="sm" onClick={() => setAssociateId(sale.id)}>
                        Associar
                      </Button>
                    ) : inDebt ? (
                      <Button variant="ghost" size="sm" onClick={() => markPaid(sale.id)}>
                        Registar pagamento
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="caption-style text-subtle h-[120px] text-center">
                  {view === "por-associar"
                    ? "Todas as compras estão associadas a um cliente."
                    : "Nenhuma venda corresponde aos filtros."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {visible.length > 200 && (
          <p className="caption-style text-subtle px-4 py-3">
            A mostrar as 200 vendas mais recentes de {formatNumber(visible.length)}. Use os filtros ou exporte para ver todas.
          </p>
        )}
      </ScrollArea>
    </section>
  );
}
