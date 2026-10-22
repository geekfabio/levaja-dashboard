import { OWNERS } from "@/data/companies";
import { OPPORTUNITY_STAGES } from "@/data/opportunities";
import { ALL_OWNERS, ANY_STAGE } from "@/lib/opportunities";

export const OWNER_OPTIONS = [
  { value: ALL_OWNERS, label: "Todos os gestores" },
  ...OWNERS.map((owner) => ({ value: owner.name, label: owner.name })),
];

export const STAGE_OPTIONS = [
  { value: ANY_STAGE, label: "Qualquer fase" },
  ...OPPORTUNITY_STAGES.map((stage) => ({ value: stage, label: stage })),
];
