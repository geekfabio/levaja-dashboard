"use client";

import type { DragEvent } from "react";
import Avatar from "@/components/_ui/avatar";
import { Checkbox } from "@/components/_ui/checkbox";
import Tag from "@/components/_ui/tag";
import { ownerByName } from "@/data/companies";
import type { Task } from "@/data/tasks";
import { formatDateShort } from "@/lib/format";
import { isDueSoon, isOverdue } from "@/lib/tasks";

type TaskCardProps = {
  task: Task;
  todayIso: string;
  onToggleDone: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
};

export default function TaskCard({
  task,
  todayIso,
  onToggleDone,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const assignee = ownerByName(task.assignee);
  const overdue = isOverdue(task, todayIso);
  const dueSoon = isDueSoon(task, todayIso);
  const dueTone = overdue ? "red" : dueSoon ? "amber" : "neutral";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="ease-power3-out flex cursor-grab flex-col gap-2 rounded-lg border border-line-strong bg-card p-3 text-left shadow-[0px_1px_0px_0px_rgba(255,255,255,0.04)] transition-colors duration-150 hover:bg-[var(--card-raised)] active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="lead-style font-medium">{task.title}</span>
        <Checkbox
          checked={task.status === "Feita"}
          onCheckedChange={onToggleDone}
          aria-label="Marcar tarefa como feita"
        />
      </div>
      <span className="caption-style text-subtle truncate">
        {task.companyName ?? "Sem cliente associado"}
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <Avatar src={assignee.avatar} alt={assignee.name} />
          <span className="caption-style text-soft truncate">
            {assignee.name}
          </span>
        </span>
        <Tag size="sm" tone={dueTone}>
          {overdue ? "Atrasada" : formatDateShort(task.dueDate)}
        </Tag>
      </div>
    </div>
  );
}
