export type CommissionTier = {
  from: number;
  rate: number;
};

export const COMMISSION_TIERS: CommissionTier[] = [
  { from: 0, rate: 1 },
  { from: 80, rate: 1.5 },
  { from: 100, rate: 2 },
];

export const OVERACHIEVEMENT_THRESHOLD = 120;

export const OVERACHIEVEMENT_BONUS = 50_000;

export const DEFAULT_MONTHLY_TARGET = 8_000_000;

export const MONTHLY_TARGETS: Record<string, number> = {
  "Sara Neto": 12_000_000,
  "Jaime Teixeira": 6_000_000,
  "Mariana Capitão": 9_000_000,
  "Nádia Jamba": 5_000_000,
  "Alexandre Santos": 10_000_000,
  "Marcos Domingos": 9_000_000,
  "André Kiala": 6_000_000,
  "Lina Wamba": 7_000_000,
  "Jamile Fonseca": 6_000_000,
  "Graça Miguel": 8_000_000,
  "Nelson Lemos": 11_000_000,
  "Emília Garcia": 6_000_000,
  "Olívio Chico": 6_000_000,
  "Avelina Brito": 6_000_000,
};
