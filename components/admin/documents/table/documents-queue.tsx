"use client";

import AsyncState from "@/components/_common/async-state";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { DocumentStateBadge } from "@/components/admin/shared/provider-badges";
import { errorMessage } from "@/data/leva-ja";
import type { DocumentReviewItem, Page } from "@/data/leva-ja";
import { formatDateNumeric, formatDateTimeNumeric, formatElapsed } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";

type QueryResult = {
  data: Page<DocumentReviewItem> | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  error: unknown;
  refetch: () => unknown;
};

type Props = {
  query: QueryResult;
  now: number;
  onReview: (item: DocumentReviewItem) => void;
  onPageChange: (page: number) => void;
};

export default function DocumentsQueue({ query, now, onReview, onPageChange }: Props) {
  return (
    <AsyncState
      query={query}
      skeleton={
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      }
      errorDescription={errorMessage}
      isEmpty={(page) => page.items.length === 0}
      empty={{ title: "Fila vazia", description: "Não há documentos à espera de validação com estes filtros." }}
    >
      {(page) => (
        <div className="flex flex-col">
          <div className="overflow-x-auto">
            <Table aria-label="Documentos por validar" className={query.isPlaceholderData ? "opacity-60" : undefined}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Documento</TableHead>
                  <TableHead scope="col">Prestador</TableHead>
                  <TableHead scope="col">Estado</TableHead>
                  <TableHead scope="col">Enviado</TableHead>
                  <TableHead scope="col">Validade indicada</TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Acções</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((item) => (
                  <TableRow key={item.document.id}>
                    <TableCell className="font-medium">{item.document.title}</TableCell>
                    <TableCell>
                      <Button variant="link" size="none" href={`${SECTION_ROUTES.providers}/${item.providerId}`}>
                        {item.providerName}
                      </Button>
                      <span className="caption-style text-subtle ml-2">{item.vehiclePlate}</span>
                    </TableCell>
                    <TableCell>
                      <DocumentStateBadge state={item.document.state} />
                    </TableCell>
                    <TableCell className="text-soft tabular-nums" title={formatDateTimeNumeric(item.submittedAt)}>
                      há {formatElapsed(item.submittedAt, now)}
                    </TableCell>
                    <TableCell className="text-soft tabular-nums">{formatDateNumeric(item.document.validUntil)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="primary" size="sm" onClick={() => onReview(item)} aria-label={`Rever ${item.document.title} de ${item.providerName}`}>
                        Rever
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page.page} pageSize={page.pageSize} total={page.total} onPageChange={onPageChange} label="Paginação da fila" className="px-0" />
        </div>
      )}
    </AsyncState>
  );
}
