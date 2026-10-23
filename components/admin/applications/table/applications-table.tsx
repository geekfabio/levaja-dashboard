"use client";

import { useCallback, useState } from "react";
import AsyncState from "@/components/_common/async-state";
import FilterMenu from "@/components/_common/filter-menu";
import Pagination from "@/components/_common/pagination";
import Button from "@/components/_ui/button";
import Skeleton from "@/components/_ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/_ui/table";
import SearchField from "@/components/admin/shared/search-field";
import { ToneBadge } from "@/components/admin/shared/status-badge";
import { errorMessage } from "@/data/leva-ja";
import { useClock } from "@/hooks/admin/use-clock";
import { useApplications } from "@/hooks/admin/use-network";
import { formatElapsed, formatNumber } from "@/lib/format";
import { APPLICATION_SOURCE_LABELS, APPLICATION_STAGE_LABELS, APPLICATION_STAGE_TONES, REQUIRED_APPLICATION_DOCUMENTS } from "@/lib/leva-ja/quality";
import { VEHICLE_CLASS_LABELS } from "@/lib/leva-ja/services";
import type { ApplicationStage, Zone } from "@/types/leva-ja";

const STAGE_OPTIONS = [
  { value: "open", label: "Em curso" },
  ...(Object.keys(APPLICATION_STAGE_LABELS) as ApplicationStage[]).map((stage) => ({ value: stage, label: APPLICATION_STAGE_LABELS[stage] })),
  { value: "all", label: "Todas" },
];

const OPEN_STAGES: ApplicationStage[] = ["submitted", "documents", "interview", "inspection"];

export default function ApplicationsTable({ zones, onOpen }: { zones: Zone[]; onOpen: (id: string) => void }) {
  const now = useClock();
  const [stage, setStage] = useState("open");
  const [zone, setZone] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useApplications({
    stage: stage === "all" ? undefined : stage === "open" ? OPEN_STAGES : [stage as ApplicationStage],
    zone: zone === "all" ? undefined : [zone],
    q: q || undefined,
    page,
    pageSize: 15,
  });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);
  const zoneName = (id: string) => zones.find((item) => item.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Pesquisar candidaturas" placeholder="Código, nome, telefone ou matrícula" onSearch={onSearch} />
        <FilterMenu
          label="Etapa"
          value={stage}
          options={STAGE_OPTIONS}
          onChange={(value) => {
            setStage(value);
            setPage(1);
          }}
        />
        <FilterMenu
          label="Zona"
          value={zone}
          options={[{ value: "all", label: "Todas" }, ...zones.map((item) => ({ value: item.id, label: item.name }))]}
          onChange={(value) => {
            setZone(value);
            setPage(1);
          }}
        />
      </div>
      <AsyncState
        query={list}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        errorDescription={errorMessage}
        isEmpty={(data) => data.items.length === 0}
        empty={{ title: "Sem candidaturas", description: "Não há candidaturas com estes filtros." }}
      >
        {(data) => (
          <div className="border-border bg-card flex flex-col rounded-xl border">
            <div className="overflow-x-auto">
              <Table aria-label="Candidaturas" className={list.isPlaceholderData ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Candidato</TableHead>
                    <TableHead scope="col">Viatura</TableHead>
                    <TableHead scope="col">Zona</TableHead>
                    <TableHead scope="col">Origem</TableHead>
                    <TableHead scope="col" className="text-right">
                      Documentos
                    </TableHead>
                    <TableHead scope="col">Recebida</TableHead>
                    <TableHead scope="col">Etapa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>
                        <Button variant="link" size="none" onClick={() => onOpen(application.id)} aria-label={`Abrir candidatura ${application.code} de ${application.name}`}>
                          {application.name}
                        </Button>
                        <span className="caption-style text-subtle block pt-0.5 tabular-nums">
                          {application.code} · {application.phone}
                        </span>
                      </TableCell>
                      <TableCell>
                        {application.vehicleLabel}
                        <span className="caption-style text-subtle block pt-0.5">
                          {VEHICLE_CLASS_LABELS[application.vehicleClass]} · {application.plate}
                        </span>
                      </TableCell>
                      <TableCell className="text-soft">{zoneName(application.zoneId)}</TableCell>
                      <TableCell className="text-soft">{APPLICATION_SOURCE_LABELS[application.source]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(application.documentsReceived.length)}/{REQUIRED_APPLICATION_DOCUMENTS.length}
                      </TableCell>
                      <TableCell className="text-soft">há {formatElapsed(application.submittedAt, now)}</TableCell>
                      <TableCell>
                        <ToneBadge tone={APPLICATION_STAGE_TONES[application.stage]} label={APPLICATION_STAGE_LABELS[application.stage]} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} label="Paginação das candidaturas" className="border-border border-t" />
          </div>
        )}
      </AsyncState>
    </div>
  );
}
