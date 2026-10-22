import { ACTIVITY_TYPES } from "@/data/activities";
import { COMPANIES, OWNERS } from "@/data/companies";
import {
  ALL_COMPANIES,
  ALL_OWNERS,
  ANY_TYPE,
  ANY_WINDOW,
} from "@/lib/activities";

export const TYPE_OPTIONS = [
  { value: ANY_TYPE, label: "Qualquer tipo" },
  ...ACTIVITY_TYPES.map((type) => ({ value: type, label: type })),
];

export const OWNER_OPTIONS = [
  { value: ALL_OWNERS, label: "Todos os gestores" },
  ...OWNERS.map((owner) => ({ value: owner.name, label: owner.name })),
];

export const COMPANY_OPTIONS = [
  { value: ALL_COMPANIES, label: "Todos os clientes" },
  ...COMPANIES.map((company) => ({ value: company.id, label: company.name })),
];

export const WINDOW_OPTIONS = [
  { value: ANY_WINDOW, label: "Todo o período" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];
