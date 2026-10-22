"use client";

import { useState } from "react";
import AsyncState from "@/components/_common/async-state";
import Pagination from "@/components/_common/pagination";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import { errorMessage } from "@/data/leva-ja";
import { useProviderTransactions } from "@/hooks/admin/use-providers";
import { formatDateTimeNumeric, formatKz } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProviderAccount } from "@/types/leva-ja";
import { TRANSACTION_KIND_LABELS, TRANSACTION_STATUS_LABELS } from "@/lib/leva-ja/services";
import { TRANSACTION_STATUS_TONES } from "@/components/admin/shared/status-badge";


export default function ProviderWallet({ provider }: { provider: ProviderAccount }) {
  const [page, setPage] = useState(1);
  const query = useProviderTransactions(provider.id, { page, pageSize: 10 });

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Saldo disponível", value: formatKz(provider.balance) },
          { label: "Ganhos totais", value: formatKz(provider.totalEarnings) },
          { label: "Serviços pagos", value: String(provider.completedCount) },
        ].map((item) => (
          <div key={item.label} className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
            <dt className="caption-style text-subtle">{item.label}</dt>
            <dd className="text-[20px] leading-none font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
      <AsyncState
        query={query}
        skeleton={<Skeleton className="h-64" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: "Sem transacções", description: "As transacções aparecem quando o prestador conclui serviços." }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Transacções do prestador">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Data</TableHead>
                    <TableHead scope="col">Descrição</TableHead>
                    <TableHead scope="col">Tipo</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col" className="text-right">
                      Valor
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-soft tabular-nums">{formatDateTimeNumeric(transaction.at)}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{transaction.title}</TableCell>
                      <TableCell className="text-soft">{TRANSACTION_KIND_LABELS[transaction.kind]}</TableCell>
                      <TableCell>
                        <Tag tone={TRANSACTION_STATUS_TONES[transaction.status]} size="sm">
                          {TRANSACTION_STATUS_LABELS[transaction.status]}
                        </Tag>
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", transaction.amount < 0 ? "text-danger" : "text-success")}>
                        {transaction.amount > 0 ? "+" : ""}
                        {formatKz(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das transacções" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
    </div>
  );
}
