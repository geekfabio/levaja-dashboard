"use client";

import TotalsBar from "@/components/_common/totals/totals-bar";
import type { Activity } from "@/data/activities";
import type { Task } from "@/data/tasks";
import { formatNumber, plural } from "@/lib/format";

type ActivitiesTotalsProps = {
  activities: Activity[];
  tasks: Task[];
  today: string;
};

export default function ActivitiesTotals({ activities, tasks, today }: ActivitiesTotalsProps) {
  const count = (types: Activity["type"][]) =>
    activities.filter((activity) => types.includes(activity.type)).length;
  const pending = tasks.filter((task) => task.status !== "Feita");
  const late = pending.filter((task) => task.dueDate < today).length;
  const dueToday = pending.filter((task) => task.dueDate === today).length;

  return (
    <TotalsBar
      id="atividades"
      summary={`${plural(activities.length, "registo", "registos")} · ${plural(pending.length, "tarefa por fazer", "tarefas por fazer")}`}
      items={[
        { key: "registos", label: "Registos", value: formatNumber(activities.length), hint: "com os filtros atuais" },
        { key: "visitas", label: "Visitas e entregas", value: formatNumber(count(["Visita", "Entrega"])) },
        { key: "contactos", label: "Chamadas e e-mails", value: formatNumber(count(["Chamada", "E-mail"])) },
        {
          key: "reclamacoes",
          label: "Reclamações",
          value: formatNumber(count(["Reclamação"])),
          tone: count(["Reclamação"]) > 0 ? "warning" : undefined,
        },
        { key: "pendentes", label: "Tarefas por fazer", value: formatNumber(pending.length), hint: `${dueToday} para hoje` },
        { key: "atrasadas", label: "Tarefas atrasadas", value: formatNumber(late), tone: late > 0 ? "danger" : undefined },
      ]}
    />
  );
}
