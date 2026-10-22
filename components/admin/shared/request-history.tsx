"use client";

import Link from "next/link";
import AsyncState from "@/components/_common/async-state";
import Pagination from "@/components/_common/pagination";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import type { Page } from "@/data/leva-ja";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { SERVICE_SHORT_LABELS } from "@/lib/leva-ja/services";
import type { ServiceRequest } from "@/types/leva-ja";
import RequestStatusBadge from "./status-badge";

type QueryResult = {
  data: Page<ServiceRequest> | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => unknown;
};

type Props = {
  query: QueryResult;
  counterpart: "client" | "provider";
  onPageChange: (page: number) => void;
  canOpen: boolean;
};

export default function RequestHistory({ query, counterpart, onPageChange, canOpen }: Props) {
  return (
    <AsyncState
      query={query}
      skeleton={<Skeleton className="h-64" />}
      errorDescription={errorMessage}
      isEmpty={(page) => page.items.length === 0}
      empty={{ title: "Sem pedidos", description: "Ainda não há pedidos registados." }}
    >
      {(page) => (
        <div className="border-border bg-card flex flex-col rounded-xl border">
          <div className="overflow-x-auto">
            <Table aria-label="Histórico de pedidos">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Código</TableHead>
                  <TableHead scope="col">Serviço</TableHead>
                  <TableHead scope="col">Estado</TableHead>
                  <TableHead scope="col">{counterpart === "client" ? "Cliente" : "Prestador"}</TableHead>
                  <TableHead scope="col">Data</TableHead>
                  <TableHead scope="col" className="text-right">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium tabular-nums">
                      {canOpen ? (
                        <Link href={`${SECTION_ROUTES.requests}/${request.id}`} className="focus-visible:ring-ring/60 rounded-sm outline-none hover:underline focus-visible:ring-2">
                          {request.code}
                        </Link>
                      ) : (
                        request.code
                      )}
                    </TableCell>
                    <TableCell>{SERVICE_SHORT_LABELS[request.kind]}</TableCell>
                    <TableCell>
                      <RequestStatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="text-soft max-w-[180px] truncate">
                      {(counterpart === "client" ? request.client?.name : request.provider?.name) ?? "—"}
                    </TableCell>
                    <TableCell className="text-soft tabular-nums">{formatDateTimeNumeric(request.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatKz(request.price.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page.page} pageSize={page.pageSize} total={page.total} onPageChange={onPageChange} label="Paginação do histórico" className="border-border border-t" />
        </div>
      )}
    </AsyncState>
  );
}
