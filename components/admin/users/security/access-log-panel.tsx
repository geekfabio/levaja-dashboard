"use client";

import { useCallback, useState } from "react";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import SearchField from "@/components/admin/shared/search-field";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { useAccessLog } from "@/hooks/admin/use-trust";
import { formatDateTimeNumeric } from "@/lib/format";
import { ACCESS_RESULT_LABELS, ACCESS_RESULT_TONES } from "@/lib/leva-ja/trust";
import type { AccessResult } from "@/types/leva-ja";

const RESULT_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "failed", label: "Tentativas falhadas" },
  ...(Object.keys(ACCESS_RESULT_LABELS) as AccessResult[]).map((result) => ({
    value: result,
    label: ACCESS_RESULT_LABELS[result],
  })),
];

const FAILED: AccessResult[] = ["wrong_code", "two_factor_failed", "inactive"];

export default function AccessLogPanel() {
  const [result, setResult] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useAccessLog({
    result: result === "all" ? undefined : result === "failed" ? FAILED : [result as AccessResult],
    q: q || undefined,
    page,
    pageSize: 15,
  });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Pesquisar por e-mail, nome ou endereço IP" placeholder="E-mail, nome ou IP" onSearch={onSearch} />
        <FilterMenu
          label="Resultado"
          value={result}
          options={RESULT_OPTIONS}
          onChange={(value) => {
            setResult(value);
            setPage(1);
          }}
        />
      </div>
      <AsyncState
        query={query}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{
          title: "Sem registos",
          description: "Não há entradas com estes filtros.",
        }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Registo de acessos" className={query.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Data</TableHead>
                    <TableHead scope="col">E-mail</TableHead>
                    <TableHead scope="col">Resultado</TableHead>
                    <TableHead scope="col">Endereço IP</TableHead>
                    <TableHead scope="col">Dispositivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-soft whitespace-nowrap tabular-nums">{formatDateTimeNumeric(entry.at)}</TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          <span>{entry.email}</span>
                          {entry.userName ? <span className="caption-style text-subtle">{entry.userName}</span> : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={ACCESS_RESULT_TONES[entry.result]} label={ACCESS_RESULT_LABELS[entry.result]} />
                      </TableCell>
                      <TableCell className="text-soft tabular-nums">{entry.ip}</TableCell>
                      <TableCell className="text-soft">{entry.device}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação do registo de acessos" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
    </div>
  );
}
