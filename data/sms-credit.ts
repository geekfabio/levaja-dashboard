export const SMS_PACKAGES = [50_000, 100_000, 250_000, 500_000] as const;

export type TopUpStatus = "A aguardar pagamento" | "Confirmado" | "Cancelado";

export type TopUp = {
  id: string;
  at: string;
  amount: number;
  reference: string;
  status: TopUpStatus;
  by: string;
};

export const INITIAL_SMS_BALANCE = 64_000;

export const LOW_BALANCE_THRESHOLD = 20_000;

export const TOP_UPS: TopUp[] = [
  { id: "tu-2", at: "2026-09-22T10:15", amount: 100_000, reference: "MCX 4412 0981 22", status: "Confirmado", by: "Tiago Fernandes" },
  { id: "tu-1", at: "2026-08-05T09:40", amount: 50_000, reference: "MCX 4412 0533 17", status: "Confirmado", by: "Tiago Fernandes" },
];
