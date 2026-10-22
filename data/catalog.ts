import type { Segment } from "./companies";

export const CATALOG_CATEGORIES = [
  "Mercearia",
  "Bebidas",
  "Óleos e gorduras",
  "Arroz e massas",
  "Laticínios",
  "Congelados",
  "Higiene e limpeza",
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export const VAT_RATE = 14;

export type Product = {
  id: string;
  name: string;
  category: CatalogCategory;
  unit: string;
  price: number;
  active: boolean;
};

export const CATALOG: Product[] = [
  { id: "MER-001", name: "Açúcar 25 kg", category: "Mercearia", unit: "saco", price: 32_500, active: true },
  { id: "MER-002", name: "Farinha de trigo 50 kg", category: "Mercearia", unit: "saco", price: 41_000, active: true },
  { id: "MER-003", name: "Feijão manteiga 25 kg", category: "Mercearia", unit: "saco", price: 38_000, active: true },
  { id: "BEB-001", name: "Água mineral 1,5 L (pack 6)", category: "Bebidas", unit: "pack", price: 1_900, active: true },
  { id: "BEB-002", name: "Refrigerante 33 cl (grade 24)", category: "Bebidas", unit: "grade", price: 9_800, active: true },
  { id: "BEB-003", name: "Sumo 1 L (caixa 12)", category: "Bebidas", unit: "caixa", price: 14_400, active: true },
  { id: "OLE-001", name: "Óleo alimentar 20 L", category: "Óleos e gorduras", unit: "bidão", price: 46_000, active: true },
  { id: "OLE-002", name: "Margarina 10 kg", category: "Óleos e gorduras", unit: "balde", price: 27_500, active: true },
  { id: "ARR-001", name: "Arroz agulha 25 kg", category: "Arroz e massas", unit: "saco", price: 29_900, active: true },
  { id: "ARR-002", name: "Massa esparguete 20 × 500 g", category: "Arroz e massas", unit: "fardo", price: 12_600, active: true },
  { id: "LAT-001", name: "Leite UHT 1 L (caixa 12)", category: "Laticínios", unit: "caixa", price: 13_200, active: true },
  { id: "LAT-002", name: "Leite em pó 2,5 kg", category: "Laticínios", unit: "lata", price: 21_000, active: true },
  { id: "CON-001", name: "Coxas de frango 10 kg", category: "Congelados", unit: "caixa", price: 24_500, active: true },
  { id: "CON-002", name: "Carapau 20 kg", category: "Congelados", unit: "caixa", price: 36_000, active: true },
  { id: "HIG-001", name: "Detergente 5 L", category: "Higiene e limpeza", unit: "garrafão", price: 6_800, active: true },
  { id: "HIG-002", name: "Sabão em barra (caixa 40)", category: "Higiene e limpeza", unit: "caixa", price: 15_400, active: true },
];

export const PRICE_LIST_DISCOUNTS: Record<Segment, number> = {
  Grossista: 6,
  Revendedor: 4,
  HORECA: 3,
  Retalho: 0,
};
