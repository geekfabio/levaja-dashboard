import type {
  CargoType,
  DocumentState,
  PaymentMethodKind,
  ServiceKind,
  TicketPriority,
  TicketStatus,
  TowIncident,
  VehicleClass,
  WithdrawalStatus,
  SosStatus,
  ProviderDisplayStatus,
  ProviderDocument,
  Transaction,
} from "@/types/leva-ja";

export const SERVICE_KINDS: readonly ServiceKind[] = ["tow", "cargo", "small_move", "house_move"];

export const SERVICE_LABELS: Record<ServiceKind, string> = {
  tow: "Reboque de viatura",
  cargo: "Carga com pickup",
  small_move: "Mudança pequena",
  house_move: "Mudança de casa",
};

export const SERVICE_SHORT_LABELS: Record<ServiceKind, string> = {
  tow: "Reboque",
  cargo: "Carga",
  small_move: "Mudança pequena",
  house_move: "Mudança de casa",
};

export const SERVICE_CHART_COLORS: Record<ServiceKind, string> = {
  tow: "var(--chart-1)",
  cargo: "var(--chart-2)",
  small_move: "var(--chart-3)",
  house_move: "var(--chart-4)",
};

export const PAYMENT_LABELS: Record<PaymentMethodKind, string> = {
  bank_reference: "Referência Multicaixa",
  card: "Cartão",
  cash: "Numerário",
};

export const PAYMENT_METHODS: readonly PaymentMethodKind[] = ["bank_reference", "card", "cash"];

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  tow_truck: "Reboque",
  pickup: "Pickup",
  van: "Carrinha",
  truck: "Camião",
};

export const VEHICLE_SERVICES: Record<VehicleClass, ServiceKind[]> = {
  tow_truck: ["tow"],
  pickup: ["cargo", "small_move"],
  van: ["cargo", "small_move", "house_move"],
  truck: ["small_move", "house_move"],
};

export const DOCUMENT_STATE_LABELS: Record<DocumentState, string> = {
  verified: "Verificado",
  pending: "Por validar",
  expired: "Expirado",
  needs_update: "Requer actualização",
};

export const DOCUMENT_TITLES: Record<ProviderDocument["icon"], string> = {
  license: "Carta de condução",
  id: "Bilhete de identidade",
  vehicle: "Documento da viatura",
  insurance: "Seguro",
};

export const DOCUMENT_ICONS: readonly ProviderDocument["icon"][] = ["license", "id", "vehicle", "insurance"];

export const PROVIDER_STATUS_LABELS: Record<ProviderDisplayStatus, string> = {
  online: "Online",
  offline: "Offline",
  suspended: "Suspenso",
};

export const TOW_INCIDENT_LABELS: Record<TowIncident, string> = {
  breakdown: "Avaria",
  accident: "Acidente",
  flat_tire: "Pneu furado",
  battery: "Bateria descarregada",
  other: "Outro",
};

export const CARGO_TYPE_LABELS: Record<CargoType, string> = {
  goods: "Mercadoria",
  construction: "Material de construção",
  furniture: "Mobiliário",
  appliances: "Electrodomésticos",
  other: "Outro",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Aberta",
  in_progress: "Em tratamento",
  resolved: "Resolvida",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export const SOS_STATUS_LABELS: Record<SosStatus, string> = {
  open: "Aberto",
  acknowledged: "Em acompanhamento",
  resolved: "Resolvido",
};

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  paid: "Pago",
};

export const TRANSACTION_KIND_LABELS: Record<Transaction["kind"], string> = {
  earning: "Ganho",
  fee: "Comissão",
  withdrawal: "Levantamento",
  refund: "Reembolso",
  penalty: "Multa",
};

export const TRANSACTION_STATUS_LABELS: Record<Transaction["status"], string> = {
  completed: "Concluída",
  pending: "Pendente",
  failed: "Falhada",
};
