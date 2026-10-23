"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/shell/admin-header";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import { useClientsList } from "@/hooks/admin/use-clients";
import { formatDateNumeric, formatDecimal, formatKz, formatNumber } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import SearchIcon from "@/public/assets/images/_common/search.svg";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "blocked", label: "Bloqueados" },
];

const PAGE_SIZE = 20;

export default function Clients() {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useClientsList({ blocked: status === "all" ? undefined : status === "blocked", q: q || undefined, page, pageSize: PAGE_SIZE });
  const filtered = status !== "all" || Boolean(q);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Clientes" count={list.data?.total} />
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-4">
        <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[320px]">
          <span className="sr-only">Pesquisar por nome, e-mail ou telefone</span>
          <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
          <Input type="search" value={query} placeholder="Nome, e-mail ou telefone" onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
        </label>
        <FilterMenu
          label="Estado"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("all");
              setQuery("");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>
      <div className="border-border relative flex min-h-0 flex-1 flex-col border-t">
        <AsyncState
          query={list}
          skeleton={
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 10 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          }
          errorDescription={errorMessage}
          isEmpty={(data) => data.items.length === 0}
          empty={{ title: filtered ? "Nenhum cliente com estes filtros" : "Ainda não há clientes" }}
        >
          {(data) => (
            <>
              <ScrollArea orientation="both" className="min-h-0 flex-1">
                <Table aria-label="Clientes" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                  <TableHeader className="bg-background sticky top-0 z-10">
                    <TableRow>
                      <TableHead scope="col">Cliente</TableHead>
                      <TableHead scope="col">E-mail</TableHead>
                      <TableHead scope="col">Estado</TableHead>
                      <TableHead scope="col" className="text-right">Pedidos</TableHead>
                      <TableHead scope="col" className="text-right">Total gasto</TableHead>
                      <TableHead scope="col">Avaliação</TableHead>
                      <TableHead scope="col">Cliente desde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((client) => {
                      const href = `${SECTION_ROUTES.clients}/${client.id}`;
                      return (
                        <TableRow
                          key={client.id}
                          onClick={(event) => {
                            if ((event.target as HTMLElement).closest("a")) return;
                            router.push(href);
                          }}
                          className="hover:bg-muted/60 cursor-pointer"
                        >
                          <TableCell>
                            <span className="flex items-center gap-2">
                              <span aria-hidden className="bg-muted text-soft flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                                {client.initials}
                              </span>
                              <span className="flex min-w-0 flex-col gap-1">
                                <Link href={href} className="focus-visible:ring-ring/60 truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-2">
                                  {client.name}
                                </Link>
                                <span className="caption-style text-subtle">{client.phone}</span>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-soft">{client.email}</TableCell>
                          <TableCell>
                            <ToneBadge tone={client.blocked ? "danger" : "success"} label={client.blocked ? "Bloqueado" : "Activo"} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(client.requestsCount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatKz(client.totalSpent)}</TableCell>
                          <TableCell className="tabular-nums">{formatDecimal(client.rating, 1)} ★</TableCell>
                          <TableCell className="text-soft tabular-nums">{formatDateNumeric(client.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação dos clientes" className="border-border border-t" />
            </>
          )}
        </AsyncState>
      </div>
    </section>
  );
}
