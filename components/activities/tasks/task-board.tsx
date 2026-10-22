"use client";

import { useState, type DragEvent } from "react";
import { ScrollArea } from "@/components/_ui/scroll-area";
import TaskColumn from "./task-column";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/data/tasks";
import { groupTasksByStatus } from "@/lib/tasks";
import { useActivitiesStore } from "@/stores/activities-store";

type TaskBoardProps = {
  tasks: Task[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TaskBoard({ tasks }: TaskBoardProps) {
  const moveTaskStatus = useActivitiesStore((state) => state.moveTaskStatus);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const groups = groupTasksByStatus(tasks);
  const todayIso = today();

  function handleCardDragStart(event: DragEvent<HTMLDivElement>, id: string) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, status: TaskStatus) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || draggingId;
    setDragOverStatus(null);
    setDraggingId(null);
    if (id) moveTaskStatus(id, status);
  }

  return (
    <ScrollArea orientation="both" className="min-h-0 flex-1">
      <div className="flex min-w-max gap-3 p-4">
        {TASK_STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={groups.get(status) ?? []}
            todayIso={todayIso}
            isDragOver={dragOverStatus === status}
            onDragEnter={() => setDragOverStatus(status)}
            onDragLeave={() =>
              setDragOverStatus((current) => (current === status ? null : current))
            }
            onDrop={(event) => handleDrop(event, status)}
            onToggleDone={moveTaskStatus}
            onCardDragStart={handleCardDragStart}
            onCardDragEnd={() => {
              setDraggingId(null);
              setDragOverStatus(null);
            }}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
