"use client";

import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { useOpenTarget } from "@/components/_common/navigation/use-open-target";
import { ACTION_LABELS } from "@/data/automations";
import { formatDateShort, formatDateTimeShort } from "@/lib/format";
import { RUN_OUTCOME_TONES, type AutomationRun } from "@/stores/automation-runs-store";

export default function RunItem({ run, showAutomation = false }: { run: AutomationRun; showAutomation?: boolean }) {
  const openTarget = useOpenTarget();

  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <span className="flex flex-wrap items-center gap-2">
        <Tag tone={RUN_OUTCOME_TONES[run.outcome]} size="sm">
          {run.outcome}
        </Tag>
        <Button
          variant="link"
          size="none"
          className="font-medium no-underline"
          onClick={() => openTarget({ module: "Clientes", id: run.companyId, label: run.companyName })}
        >
          {run.companyName}
        </Button>
        <span className="caption-style text-subtle">
          Passo {run.stepIndex + 1} · {ACTION_LABELS[run.action]}
        </span>
      </span>
      <span className="caption-style text-soft">{run.detail}</span>
      <span className="caption-style text-subtle tabular-nums">
        {showAutomation && `${run.automationName} · `}
        {formatDateTimeShort(run.at)}
        {run.dueDate !== run.at.slice(0, 10) && ` · previsto para ${formatDateShort(run.dueDate)}`}
      </span>
    </li>
  );
}
