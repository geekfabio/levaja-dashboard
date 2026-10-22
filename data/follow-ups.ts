export const FOLLOW_UP_TYPES = ["Chamada", "Visita", "WhatsApp", "E-mail", "Reunião"] as const;

export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export type FollowUp = {
  date: string;
  type: FollowUpType;
  note: string;
  owner: string;
};

export const FOLLOW_UPS: Record<string, FollowUp> = {
  "boa-esperanca": { date: "2026-10-12", type: "Chamada", note: "Confirmar encomenda de óleo para o fim de semana.", owner: "Sara Neto" },
  "sabores-luanda": { date: "2026-10-09", type: "Visita", note: "Apresentar nova tabela de preços de bebidas.", owner: "Jamile Fonseca" },
  "nova-vida": { date: "2026-10-13", type: "Reunião", note: "Revisão do piloto com a direção.", owner: "Marcos Domingos" },
  "tchissola": { date: "2026-10-16", type: "WhatsApp", note: "Enviar promoção de farinha.", owner: "Alexandre Santos" },
  "kilamba": { date: "2026-10-10", type: "Chamada", note: "Saber se a entrega chegou completa.", owner: "Lina Wamba" },
};
