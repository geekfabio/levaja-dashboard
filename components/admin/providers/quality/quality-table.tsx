"use client";

import { useCallback, useState } from "react";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import Tag from "@/components/_ui/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import SearchField from "@/components/admin/shared/search-field";
import SummaryTiles from "@/components/admin/shared/summary-tiles";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import type { QualityFilters } from "@/data/leva-ja";
import { useQualityScores } from "@/hooks/admin/use-network";
import { formatDecimal, formatNumber, formatPercent } from "@/lib/format";
import { SECTION_ROUTES } from "@/lib/leva-ja/navigation";
import { QUALITY_FLAG_LABELS } from "@/lib/leva-ja/quality";
import type { QualityFlag } from "@/types/leva-ja";
import { scoreTone } from "./provider-quality";

const FLAG_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "flagged", label: "Com alertas" },
  ...(Object.keys(QUALITY_FLAG_LABELS) as QualityFlag[]).map((flag) => ({ value: flag, label: QUALITY_FLAG_LABELS[flag] })),
];
const SORT_OPTIONS = [
  { value: "score", label: "Pior pontuação" },
  { value: "cancellations", label: "Mais cancelamentos" },
  { value: "late", label: "Mais atrasos" },
];

export default function QualityTable() {
  const [flag, setFlag] = useState("flagged");
  const [sort, setSort] = useState("score");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useQualityScores({
    flag: flag === "all" ? undefined : flag === "flagged" ? (Object.keys(QUALITY_FLAG_LABELS) as QualityFlag[]) : [flag as QualityFlag],
    sort: sort as QualityFilters["sort"],
    q: q || undefined,
    page,
    pageSize: 15,
  });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);
  const totals = list.data?.totals;

  return (
    <div className="flex flex-col gap-4">
      <SummaryTiles
        count={3}
        tiles={
          totals
            ? [
                { label: "Pontuação média", value: totals.averageScore, display: `${formatNumber(totals.averageScore)} / 100` },
                { label: "Prestadores com alertas", value: totals.flagged, display: formatNumber(totals.flagged) },
                { label: "Penalizações activas", value: totals.activePenalties, display: formatNumber(totals.activePenalties) },
              ]
            : null
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Pesquisar prestador" placeholder="Nome do prestador" onSearch={onSearch} />
        <FilterMenu
          label="Alertas"
          value={flag}
          options={FLAG_OPTIONS}
          onChange={(value) => {
            setFlag(value);
            setPage(1);
          }}
        />
        <FilterMenu label="Ordenar" value={sort} options={SORT_OPTIONS} onChange={setSort} />
      </div>
      <AsyncState
        query={list}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: "Sem prestadores", description: "Nenhum prestador corresponde a estes filtros." }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Qualidade dos prestadores" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Prestador</TableHead>
                    <TableHead scope="col">Pontuação</TableHead>
                    <TableHead scope="col" className="text-right">
                      Serviços
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Cancelamentos
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Atrasos
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Avaliação
                    </TableHead>
                    <TableHead scope="col">Alertas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.providerId}>
                      <TableCell>
                        <Button variant="link" size="none" href={`${SECTION_ROUTES.providers}/${item.providerId}`}>
                          {item.providerName}
                        </Button>
                        {item.activePenalties > 0 && <span className="caption-style text-danger block pt-0.5">{formatNumber(item.activePenalties)} penalização(ões) activa(s)</span>}
                      </TableCell>
                      <TableCell>
                        <ToneBadge tone={scoreTone(item.score)} label={`${formatNumber(item.score)} / 100`} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(item.completed)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(item.cancelled)} · {formatPercent(item.cancellationRate * 100)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(item.lateArrivals)} · {formatPercent(item.lateRate * 100)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{item.rating === null ? "—" : `${formatDecimal(item.rating, 1)} ★`}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {item.flags.length ? (
                            item.flags.map((key) => (
                              <Tag key={key} tone="red" size="sm">
                                {QUALITY_FLAG_LABELS[key]}
                              </Tag>
                            ))
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação da qualidade" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
      <p className="caption-style text-subtle">
        Últimos 30 dias. A pontuação desce com cancelamentos, chegadas acima do prazo de chegada, avaliações baixas e disputas; os limites vêm das definições de atribuição e cancelamento.
      </p>
    </div>
  );
}
