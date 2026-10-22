import { create } from "zustand";
import { CURRENT_USER } from "@/data/companies";
import {
  CALENDAR_PROVIDERS,
  CRM_CALENDAR_NAME,
  type CalendarProviderId,
  type SyncDirection,
  type SyncKind,
} from "@/data/calendar-sync";
import { addDays } from "@/lib/follow-up";
import { formatDateShort, nowLuandaLocal, plural } from "@/lib/format";
import { useActivitiesStore } from "./activities-store";
import { recordEvent } from "./audit-store";
import { useCompaniesStore } from "./companies-store";
import { toast } from "./toast-store";

export type CalendarConnection = {
  account: string;
  connectedAt: string;
  lastSyncAt?: string;
  direction: SyncDirection;
  kinds: Record<SyncKind, boolean>;
};

export type SyncedEvent = {
  uid: string;
  provider: CalendarProviderId;
  externalId: string;
  date: string;
  title: string;
};

export type SyncLogAction = "Criado" | "Atualizado" | "Removido" | "Alterado no calendário";

export type SyncLogEntry = {
  id: string;
  at: string;
  provider: CalendarProviderId;
  action: SyncLogAction;
  title: string;
  detail: string;
};

type DesiredEvent = { uid: string; date: string; title: string; kind: SyncKind; companyId?: string };

type CalendarSyncState = {
  connections: Partial<Record<CalendarProviderId, CalendarConnection>>;
  synced: SyncedEvent[];
  log: SyncLogEntry[];
  authorizing: CalendarProviderId | null;
  startConnect: (provider: CalendarProviderId) => void;
  cancelConnect: () => void;
  confirmConnect: (account: string) => void;
  disconnect: (provider: CalendarProviderId) => void;
  setDirection: (provider: CalendarProviderId, direction: SyncDirection) => void;
  toggleKind: (provider: CalendarProviderId, kind: SyncKind) => void;
  syncNow: (provider: CalendarProviderId, options?: { silent?: boolean }) => void;
  syncAll: () => void;
  simulateExternalChange: (provider: CalendarProviderId) => void;
  syncedFor: (uid: string) => SyncedEvent[];
};

const DEFAULT_KINDS: Record<SyncKind, boolean> = { visitas: true, reunioes: true, chamadas: false, tarefas: false };

function providerName(id: CalendarProviderId) {
  return CALENDAR_PROVIDERS.find((provider) => provider.id === id)?.name ?? id;
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function desiredEvents(kinds: Record<SyncKind, boolean>): DesiredEvent[] {
  const events: DesiredEvent[] = [];
  for (const company of useCompaniesStore.getState().companies) {
    const followUp = company.nextFollowUp;
    if (company.archived || !followUp) continue;
    const kind: SyncKind = followUp.type === "Visita" ? "visitas" : followUp.type === "Reunião" ? "reunioes" : "chamadas";
    if (!kinds[kind]) continue;
    events.push({
      uid: `followup-${company.id}`,
      date: followUp.date,
      title: `${followUp.type} · ${company.name}${followUp.note ? ` — ${followUp.note}` : ""}`,
      kind,
      companyId: company.id,
    });
  }
  if (kinds.tarefas) {
    for (const task of useActivitiesStore.getState().tasks) {
      if (task.status === "Feita") continue;
      events.push({ uid: `task-${task.id}`, date: task.dueDate, title: `Tarefa · ${task.title}`, kind: "tarefas" });
    }
  }
  return events;
}

export const useCalendarSyncStore = create<CalendarSyncState>((set, get) => ({
  connections: {},
  synced: [],
  log: [],
  authorizing: null,

  startConnect: (authorizing) => set({ authorizing }),
  cancelConnect: () => set({ authorizing: null }),

  confirmConnect: (account) => {
    const provider = get().authorizing;
    if (!provider) return;
    set((state) => ({
      authorizing: null,
      connections: {
        ...state.connections,
        [provider]: {
          account: account.trim() || CURRENT_USER.email,
          connectedAt: nowLuandaLocal(),
          direction: provider === "apple" ? "Do CRM para o calendário" : "Nos dois sentidos",
          kinds: { ...DEFAULT_KINDS },
        },
      },
    }));
    recordEvent({
      action: `ligou o ${providerName(provider)} da conta`,
      target: { module: "Definições", label: account.trim() || CURRENT_USER.email },
      sensitive: true,
      notify: false,
    });
    get().syncNow(provider);
  },

  disconnect: (provider) => {
    const connection = get().connections[provider];
    if (!connection) return;
    const removed = get().synced.filter((event) => event.provider === provider).length;
    set((state) => {
      const connections = { ...state.connections };
      delete connections[provider];
      return { connections, synced: state.synced.filter((event) => event.provider !== provider) };
    });
    recordEvent({
      action: `desligou o ${providerName(provider)} da conta`,
      target: { module: "Definições", label: connection.account },
      sensitive: true,
      notify: false,
      toast: {
        title: `${providerName(provider)} desligado`,
        description: `${plural(removed, "evento removido", "eventos removidos")} do calendário «${CRM_CALENDAR_NAME}».`,
        tone: "success",
      },
    });
  },

  setDirection: (provider, direction) =>
    set((state) => {
      const connection = state.connections[provider];
      return connection ? { connections: { ...state.connections, [provider]: { ...connection, direction } } } : {};
    }),

  toggleKind: (provider, kind) => {
    set((state) => {
      const connection = state.connections[provider];
      return connection
        ? { connections: { ...state.connections, [provider]: { ...connection, kinds: { ...connection.kinds, [kind]: !connection.kinds[kind] } } } }
        : {};
    });
    get().syncNow(provider, { silent: true });
  },

  syncNow: (provider, options = {}) => {
    const connection = get().connections[provider];
    if (!connection) return;
    const at = nowLuandaLocal();
    const desired = desiredEvents(connection.kinds);
    const current = get().synced.filter((event) => event.provider === provider);
    const entries: SyncLogEntry[] = [];
    const next: SyncedEvent[] = [];

    for (const event of desired) {
      const existing = current.find((item) => item.uid === event.uid);
      if (!existing) {
        next.push({ uid: event.uid, provider, externalId: newId(provider), date: event.date, title: event.title });
        entries.push({ id: newId("log"), at, provider, action: "Criado", title: event.title, detail: formatDateShort(event.date) });
      } else if (existing.date !== event.date || existing.title !== event.title) {
        next.push({ ...existing, date: event.date, title: event.title });
        entries.push({
          id: newId("log"),
          at,
          provider,
          action: "Atualizado",
          title: event.title,
          detail: existing.date !== event.date ? `${formatDateShort(existing.date)} → ${formatDateShort(event.date)}` : "Texto atualizado",
        });
      } else {
        next.push(existing);
      }
    }
    for (const event of current) {
      if (!desired.some((item) => item.uid === event.uid)) {
        entries.push({ id: newId("log"), at, provider, action: "Removido", title: event.title, detail: "Já não está agendado no CRM" });
      }
    }

    set((state) => ({
      synced: [...state.synced.filter((event) => event.provider !== provider), ...next],
      log: [...entries.reverse(), ...state.log].slice(0, 60),
      connections: { ...state.connections, [provider]: { ...connection, lastSyncAt: at } },
    }));

    if (!options.silent) {
      const created = entries.filter((entry) => entry.action === "Criado").length;
      const updated = entries.filter((entry) => entry.action === "Atualizado").length;
      const removed = entries.filter((entry) => entry.action === "Removido").length;
      toast({
        title: `${providerName(provider)} sincronizado`,
        description:
          entries.length === 0
            ? `Nada mudou. ${plural(next.length, "evento", "eventos")} no calendário «${CRM_CALENDAR_NAME}».`
            : `${plural(created, "criado", "criados")}, ${plural(updated, "atualizado", "atualizados")}, ${plural(removed, "removido", "removidos")}.`,
        tone: "success",
      });
    }
  },

  syncAll: () => {
    for (const provider of Object.keys(get().connections) as CalendarProviderId[]) {
      get().syncNow(provider, { silent: true });
    }
  },

  simulateExternalChange: (provider) => {
    const connection = get().connections[provider];
    if (!connection || connection.direction !== "Nos dois sentidos") return;
    const candidates = get().synced.filter((event) => event.provider === provider && event.uid.startsWith("followup-"));
    const event = candidates[Math.floor(Math.random() * candidates.length)];
    if (!event) {
      toast({ title: "Nada para alterar", description: "Não há visitas ou reuniões sincronizadas neste calendário." });
      return;
    }
    const companyId = event.uid.slice("followup-".length);
    const company = useCompaniesStore.getState().companies.find((item) => item.id === companyId);
    if (!company?.nextFollowUp) return;
    const date = addDays(event.date, 1 + Math.floor(Math.random() * 3));
    useCompaniesStore.getState().scheduleFollowUp(companyId, { ...company.nextFollowUp, date }, { silent: true });
    const at = nowLuandaLocal();
    set((state) => ({
      synced: state.synced.map((item) => (item.uid === event.uid ? { ...item, date } : item)),
      log: [
        {
          id: newId("log"),
          at,
          provider,
          action: "Alterado no calendário" as const,
          title: event.title,
          detail: `${formatDateShort(event.date)} → ${formatDateShort(date)} · atualizado no CRM`,
        },
        ...state.log,
      ].slice(0, 60),
    }));
    toast({
      title: `Alteração recebida do ${providerName(provider)}`,
      description: `${company.name}: ${company.nextFollowUp.type.toLowerCase()} passou para ${formatDateShort(date)}. O Follow-up já mostra a nova data.`,
      tone: "success",
    });
  },

  syncedFor: (uid) => get().synced.filter((event) => event.uid === uid),
}));
