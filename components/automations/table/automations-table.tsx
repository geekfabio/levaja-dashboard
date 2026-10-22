"use client";

import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import { AUTOMATION_STATUS_TONES, type Automation } from "@/data/automations";
import { automationIssues, stepDays, triggerSummary } from "@/lib/automations";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useAutomationsStore } from "@/stores/automations-store";

function durationLabel(days: number) {
  if (days === 0) return "no mesmo dia";
  return days === 1 ? "1 dia" : `${days} dias`;
}

type AutomationsTableProps = {
  automations: Automation[];
};

export default function AutomationsTable({ automations }: AutomationsTableProps) {
  const openEditor = useAutomationsStore((state) => state.openEditor);
  const setAutomationStatus = useAutomationsStore((state) => state.setAutomationStatus);

  return (
    <ScrollArea orientation="both" className="min-h-0 flex-1">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead>Automação</TableHead>
            <TableHead>Sequência</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Inscritos</TableHead>
            <TableHead className="text-right">Concluídos</TableHead>
            <TableHead>Última execução</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {automations.map((automation) => {
            const days = stepDays(automation.steps);
            const canActivate = automationIssues(automation).length === 0;
            const active = automation.status === "Ativa";
            return (
              <TableRow
                key={automation.id}
                onClick={() => openEditor(automation.id)}
                className="hover:bg-card/60 cursor-pointer"
              >
                <TableCell className="max-w-[340px]">
                  <span className="flex min-w-0 flex-col gap-1">
                    <Button
                      variant="link"
                      size="none"
                      className="justify-start truncate no-underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditor(automation.id);
                      }}
                    >
                      {automation.name}
                    </Button>
                    <span className="caption-style text-subtle truncate">
                      {triggerSummary(automation.trigger)}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-soft">
                  {automation.steps.length}{" "}
                  {automation.steps.length === 1 ? "passo" : "passos"}
                  {days.length > 0 && ` · ${durationLabel(days[days.length - 1])}`}
                </TableCell>
                <TableCell>
                  <Tag tone={AUTOMATION_STATUS_TONES[automation.status]}>
                    {automation.status}
                  </Tag>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(automation.enrolled)}
                </TableCell>
                <TableCell className="text-soft text-right tabular-nums">
                  {formatNumber(automation.completed)}
                </TableCell>
                <TableCell className="text-soft tabular-nums">
                  {automation.lastRunAt ? formatDateTime(automation.lastRunAt) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant={active ? "secondary" : "subtle"}
                    size="sm"
                    disabled={!active && !canActivate}
                    title={!active && !canActivate ? "Complete a automação antes de a ativar" : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      setAutomationStatus(automation.id, active ? "Pausada" : "Ativa");
                    }}
                  >
                    {active ? "Pausar" : "Ativar"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {automations.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="caption-style text-subtle py-10 text-center">
                Sem automações para os filtros escolhidos.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
