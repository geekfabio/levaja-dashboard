import { COMPANIES } from "@/data/companies";
import { CONTACTABILITY_STATUSES } from "@/data/contacts";
import { ALL_COMPANIES, ANY_STATUS } from "@/lib/contacts";

export const COMPANY_OPTIONS = [
  { value: ALL_COMPANIES, label: "Todos os clientes" },
  ...COMPANIES.map((company) => ({ value: company.id, label: company.name })),
];

export const CONTACTABILITY_OPTIONS = [
  { value: ANY_STATUS, label: "Qualquer estado" },
  ...CONTACTABILITY_STATUSES.map((status) => ({ value: status, label: status })),
];
