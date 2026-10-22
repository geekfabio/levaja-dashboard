import { create } from "zustand";
import type { Activity, CheckIn } from "@/data/activities";
import { formatTime, nowLuandaLocal, plural } from "@/lib/format";
import { CHECK_IN_RADIUS_M, distanceMeters, formatDistance } from "@/lib/geo";
import { recordEvent } from "./audit-store";
import { useActivitiesStore } from "./activities-store";
import { useCompaniesStore } from "./companies-store";
import { toast } from "./toast-store";

const QUEUE_KEY = "registos-por-sincronizar";

type FieldState = {
  checkIns: Record<string, CheckIn>;
  locating: string | null;
  queue: Activity[];
  checkIn: (companyId: string) => void;
  todaysCheckIn: (companyId: string) => CheckIn | undefined;
  enqueue: (activity: Activity) => void;
  flush: () => void;
  restore: () => void;
};

function persist(queue: Activity[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function geolocationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "A localização está bloqueada no browser. Autorize-a para fazer check-in.";
  if (error.code === error.TIMEOUT) return "O GPS demorou demasiado. Tente de novo num sítio aberto.";
  return "Não foi possível obter a localização.";
}

export const useFieldStore = create<FieldState>((set, get) => ({
  checkIns: {},
  locating: null,
  queue: [],

  todaysCheckIn: (companyId) => {
    const checkIn = get().checkIns[companyId];
    return checkIn && checkIn.at.slice(0, 10) === nowLuandaLocal().slice(0, 10) ? checkIn : undefined;
  },

  checkIn: (companyId) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast({ title: "Sem GPS", description: "Este dispositivo não permite obter a localização.", tone: "danger" });
      return;
    }
    const company = useCompaniesStore.getState().companies.find((item) => item.id === companyId);
    if (!company) return;
    set({ locating: companyId });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        const target = company.profile?.geo;
        const distance = target ? distanceMeters(point, target) : undefined;
        const checkIn: CheckIn = {
          at: nowLuandaLocal(),
          ...point,
          accuracy: Math.round(position.coords.accuracy),
          distance,
        };
        set((state) => ({ checkIns: { ...state.checkIns, [companyId]: checkIn }, locating: null }));
        const far = distance !== undefined && distance > CHECK_IN_RADIUS_M;
        recordEvent({
          action: "fez check-in em",
          target: { module: "Clientes", id: companyId, label: company.name },
          companyId,
          notify: false,
          changes: [
            { field: "Hora", to: formatTime(checkIn.at) },
            { field: "Distância ao cliente", to: distance !== undefined ? formatDistance(distance) : "Sem coordenadas do cliente" },
          ],
          toast: {
            title: far ? "Check-in longe do cliente" : "Check-in feito",
            description:
              distance === undefined
                ? `${company.name} · o cliente ainda não tem coordenadas.`
                : `${company.name} · a ${formatDistance(distance)} da morada registada${far ? " — confirme se está no sítio certo." : "."}`,
            tone: far ? "danger" : "success",
            action: {
              label: "Registar visita",
              run: () => useActivitiesStore.getState().startActivity({ companyId, type: "Visita" }),
            },
          },
        });
      },
      (error) => {
        set({ locating: null });
        toast({ title: "Check-in falhou", description: geolocationError(error), tone: "danger" });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  },

  enqueue: (activity) => {
    const queue = [...get().queue.filter((item) => item.id !== activity.id), activity];
    set({ queue });
    persist(queue);
  },

  flush: () => {
    const queue = get().queue;
    if (queue.length === 0) return;
    const ids = new Set(queue.map((item) => item.id));
    useActivitiesStore.setState((state) => ({
      activities: state.activities.map((item) => (ids.has(item.id) ? { ...item, pendingSync: false } : item)),
    }));
    set({ queue: [] });
    persist([]);
    toast({
      title: "Rede de volta",
      description: `${plural(queue.length, "registo feito sem rede foi sincronizado", "registos feitos sem rede foram sincronizados")}.`,
      tone: "success",
    });
  },

  restore: () => {
    let stored: Activity[] = [];
    try {
      stored = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]");
    } catch {}
    if (!Array.isArray(stored) || stored.length === 0) return;
    const existing = new Set(useActivitiesStore.getState().activities.map((item) => item.id));
    const missing = stored.filter((item) => !existing.has(item.id));
    if (missing.length > 0) {
      useActivitiesStore.setState((state) => ({ activities: [...missing, ...state.activities] }));
    }
    set({ queue: stored });
    if (navigator.onLine) get().flush();
  },
}));
