"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AsyncState from "@/components/_common/async-state";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import RequestStatusBadge from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import type { Page } from "@/data/leva-ja";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { PAYMENT_LABELS, SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import type { ServiceRequest, Zone } from "@/types/leva-ja";

export const REQUEST_PAGE_SIZE = 20;

const COLUMNS = ["Código", "Serviço", "Estado", "Cliente", "Prestador", "Zona", "Total", "Pagamento", "Criado em"];

type QueryResult = {
  data: Page<ServiceRequest> | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  error: unknown;
  refetch: () => unknown;
};

type RequestsTableProps = {
  query: QueryResult;
  zones: Pick<Zone, "id" | "name">[];
  onPageChange: (page: number) => void;
  onReset: () => void;
  filtered: boolean;
};

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 10 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

export default function RequestsTable({ query, zones, onPageChange, onReset, filtered }: RequestsTableProps) {
  const router = useRouter();
  const zoneName = (id: string) => zones.find((zone) => zone.id === id)?.name ?? "—";

  return (
    <div className="border-border relative flex min-h-0 flex-1 flex-col border-t">
      <AsyncState
        query={query}
        skeleton={<SkeletonRows />}
        errorDescription={errorMessage}
        isEmpty={(page) => page.items.length === 0}
        empty={{
          title: filtered ? "Nenhum pedido com estes filtros" : "Ainda não há pedidos",
          description: filtered ? "Experimente alargar o intervalo de datas ou limpar os filtros." : undefined,
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
              <Table aria-label="Pedidos" aria-busy={query.isFetching} className={query.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader className="bg-background sticky top-0 z-10">
                  <TableRow>
                    {COLUMNS.map((column) => (
                      <TableHead key={column} scope="col" className={column === "Total" ? "text-right" : undefined}>
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.items.map((request) => {
                    const href = `${SECTION_ROUTES.requests}/${request.id}`;
                    return (
                      <TableRow
                        key={request.id}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest("a")) return;
                          router.push(href);
                        }}
                        className="hover:bg-muted/60 cursor-pointer"
                      >
                        <TableCell className="font-medium tabular-nums">
                          <Link href={href} className="focus-visible:ring-ring/60 rounded-sm outline-none hover:underline focus-visible:ring-2">
                            {request.code}
                          </Link>
                          {request.dispute && !request.dispute.resolvedAt && <span className="text-danger caption-style ml-2">Disputa</span>}
                        </TableCell>
                        <TableCell>{SERVICE_SHORT_LABELS[request.kind]}</TableCell>
                        <TableCell>
                          <RequestStatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">{request.client?.name ?? "—"}</TableCell>
                        <TableCell className="text-soft max-w-[180px] truncate">{request.provider?.name ?? "Por atribuir"}</TableCell>
                        <TableCell className="text-soft">{zoneName(request.zoneId)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatKz(request.price.total)}</TableCell>
                        <TableCell className="text-soft">{request.paymentMethod ? PAYMENT_LABELS[request.paymentMethod] : "—"}</TableCell>
                        <TableCell className="text-soft tabular-nums">{formatDateTimeNumeric(request.createdAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            <Pagination
              page={page.page}
              pageSize={page.pageSize}
              total={page.total}
              onPageChange={onPageChange}
              label="Paginação dos pedidos"
              className="border-border border-t"
            />
          </>
        )}
      </AsyncState>
    </div>
  );
}
