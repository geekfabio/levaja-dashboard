import { COMPANIES } from "./companies";

export type TaskStatus = "Por Fazer" | "Em Curso" | "Feita";

export const TASK_STATUSES: TaskStatus[] = ["Por Fazer", "Em Curso", "Feita"];

export const TASK_STATUS_TONES: Record<
  TaskStatus,
  "neutral" | "blue" | "green"
> = {
  "Por Fazer": "neutral",
  "Em Curso": "blue",
  Feita: "green",
};

export type Task = {
  id: string;
  title: string;
  companyId?: string;
  companyName?: string;
  assignee: string;
  dueDate: string;
  reminderDate?: string;
  status: TaskStatus;
  notes?: string;
};

function company(id: string) {
  return COMPANIES.find((item) => item.id === id)!;
}

export const TASKS: Task[] = [
  {
    id: "task-1",
    title: "Confirmar reposição de stock",
    companyId: "boa-esperanca",
    companyName: company("boa-esperanca").name,
    assignee: "Sara Neto",
    dueDate: "2026-10-09",
    reminderDate: "2026-10-09",
    status: "Em Curso",
    notes: "Cliente pediu confirmação antes do fim de semana.",
  },
  {
    id: "task-2",
    title: "Enviar proposta de renovação anual",
    companyId: "ilha-cabo",
    companyName: company("ilha-cabo").name,
    assignee: "Jaime Teixeira",
    dueDate: "2026-10-09",
    status: "Por Fazer",
  },
  {
    id: "task-3",
    title: "Agendar visita de acompanhamento",
    companyId: "baia-azul",
    companyName: company("baia-azul").name,
    assignee: "Mariana Capitão",
    dueDate: "2026-10-12",
    reminderDate: "2026-10-11",
    status: "Por Fazer",
  },
  {
    id: "task-4",
    title: "Validar crédito emitido por reclamação",
    companyId: "girassol",
    companyName: company("girassol").name,
    assignee: "Nádia Jamba",
    dueDate: "2026-10-05",
    status: "Por Fazer",
    notes: "Em atraso — confirmar com o armazém se o crédito já foi aplicado.",
  },
  {
    id: "task-5",
    title: "Atualizar lista de preços do cliente",
    companyId: "tchissola",
    companyName: company("tchissola").name,
    assignee: "Alexandre Santos",
    dueDate: "2026-10-15",
    status: "Em Curso",
  },
  {
    id: "task-6",
    title: "Preparar apresentação da gama institucional",
    companyId: "talatona-plaza",
    companyName: company("talatona-plaza").name,
    assignee: "Catarina Sacramento",
    dueDate: "2026-10-20",
    status: "Por Fazer",
  },
  {
    id: "task-7",
    title: "Confirmar dados bancários para faturação",
    companyId: "zango",
    companyName: company("zango").name,
    assignee: "Emília Garcia",
    dueDate: "2026-09-30",
    status: "Feita",
  },
  {
    id: "task-8",
    title: "Rever segmentação de clientes em risco",
    assignee: "Tiago Fernandes",
    dueDate: "2026-10-16",
    status: "Por Fazer",
    notes: "Cruzar com a lista de clientes em risco da Previsão.",
  },
];
