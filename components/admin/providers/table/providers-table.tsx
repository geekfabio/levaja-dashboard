"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AsyncState from "@/components/_common/async-state";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { ProviderStatusBadge, VerificationBadge } from "@/components/admin/shared/provider-badges";
import { errorMessage } from "@/data/leva-ja";
import type { Page } from "@/data/leva-ja";
import { formatDecimal, formatKz } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import type { ProviderAccount, Zone } from "@/types/leva-ja";

export const PROVIDER_PAGE_SIZE = 20;

type QueryResult = {
  data: Page<ProviderAccount> | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  error: unknown;
  refetch: () => unknown;
};

type Props = {
  query: QueryResult;
  zones: Pick<Zone, "id" | "name">[];
  filtered: boolean;
  onPageChange: (page: number) => void;
  onReset: () => void;
};

const COLUMNS = ["Prestador", "Estado", "Verificação", "Avaliação", "Viatura", "Zonas", "Ganhos", "Saldo"];

export default function ProvidersTable({ query, zones, filtered, onPageChange, onReset }: Props) {
  const router = useRouter();
  const zoneName = (id: string) => zones.find((zone) => zone.id === id)?.name ?? id;

  return (
    <div className="border-border relative flex min-h-0 flex-1 flex-col border-t">
      <AsyncState
        query={query}
        skeleton={
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        }
        errorDescription={errorMessage}
        isEmpty={(page) => page.items.length === 0}
        empty={{
          title: filtered ? "Nenhum prestador com estes filtros" : "Ainda não há prestadores",
          action: filtered ? (
            <Button variant="secondary" size="md" onClick={onReset}>
              Limpar filtros
            </Button>
          ) : undefined,
        }}
      >
        {(page) => (
          <>
            <ScrollArea orientation="both" className="min-h-0 flex-1">
              <Table aria-label="Prestadores" className={query.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader className="bg-background sticky top-0 z-10">
                  <TableRow>
                    {COLUMNS.map((column) => (
                      <TableHead key={column} scope="col" className={column === "Ganhos" || column === "Saldo" ? "text-right" : undefined}>
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.items.map((provider) => {
                    const href = `${SECTION_ROUTES.providers}/${provider.id}`;
                    return (
                      <TableRow
                        key={provider.id}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest("a")) return;
                          router.push(href);
                        }}
                        className="hover:bg-muted/60 cursor-pointer"
                      >
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <span aria-hidden className="bg-muted text-soft flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                              {provider.initials}
                            </span>
                            <span className="flex min-w-0 flex-col gap-1">
                              <Link href={href} className="focus-visible:ring-ring/60 truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-2">
                                {provider.name}
                              </Link>
                              <span className="caption-style text-subtle">{provider.phone}</span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <ProviderStatusBadge provider={provider} />
                        </TableCell>
                        <TableCell>
                          <VerificationBadge verified={provider.verified} />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatDecimal(provider.rating, 1)} ★ <span className="caption-style text-subtle">({provider.reviewsCount})</span>
                        </TableCell>
                        <TableCell className="text-soft">
                          {provider.vehicle.categoryLabel} · {provider.vehicle.plate}
                        </TableCell>
                        <TableCell className="text-soft max-w-[200px] truncate" title={provider.zoneIds.map(zoneName).join(", ")}>
                          {provider.zoneIds.map(zoneName).join(", ")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatKz(provider.totalEarnings)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatKz(provider.balance)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            <Pagination page={page.page} pageSize={page.pageSize} total={page.total} onPageChange={onPageChange} label="Paginação dos prestadores" className="border-border border-t" />
          </>
        )}
      </AsyncState>
    </div>
  );
}
