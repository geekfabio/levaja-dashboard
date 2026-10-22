"use client";

import type { DragEvent } from "react";
import Tag from "@/components/_ui/tag";
import TaskCard from "./task-card";
import { TASK_STATUS_TONES, type Task, type TaskStatus } from "@/data/tasks";
import { cn } from "@/lib/utils";

type TaskColumnProps = {
  status: TaskStatus;
  tasks: Task[];
  todayIso: string;
  isDragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onToggleDone: (id: string, status: TaskStatus) => void;
  onCardDragStart: (event: DragEvent<HTMLDivElement>, id: string) => void;
  onCardDragEnd: () => void;
};

export default function TaskColumn({
  status,
  tasks,
  todayIso,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onToggleDone,
  onCardDragStart,
  onCardDragEnd,
}: TaskColumnProps) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-drag-over={isDragOver}
      className="ease-power3-out flex w-[280px] shrink-0 flex-col gap-3 rounded-xl border border-transparent bg-white/2 p-3 transition-colors duration-150 data-[drag-over=true]:border-line-strong data-[drag-over=true]:bg-white/5"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <Tag tone={TASK_STATUS_TONES[status]}>{status}</Tag>
        <span className="caption-style text-subtle">{tasks.length}</span>
      </div>

      <div className={cn("flex min-h-[60px] flex-col gap-2")}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            todayIso={todayIso}
            onToggleDone={() =>
              onToggleDone(task.id, task.status === "Feita" ? "Por Fazer" : "Feita")
            }
            onDragStart={(event) => onCardDragStart(event, task.id)}
            onDragEnd={onCardDragEnd}
          />
        ))}
        {tasks.length === 0 && (
          <div className="caption-style text-subtle flex h-[60px] items-center justify-center rounded-lg border border-dashed border-line-strong">
            Sem tarefas
          </div>
        )}
      </div>
    </div>
  );
}
