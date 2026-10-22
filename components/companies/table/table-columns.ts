export const TABLE_COLUMNS = [
  { key: "name", label: "Clientes", className: "justify-start" },
  { key: "segment", label: "Segmento e Fase", className: "justify-start" },
  { key: "owner", label: "Gestor de Conta", className: "justify-start" },
  {
    key: "openDeals",
    label: "Oportunidades Abertas",
    className: "justify-end tabular-nums",
  },
  {
    key: "pipelineValue",
    label: "Valor em Carteira",
    className: "justify-end tabular-nums",
  },
  {
    key: "winProbability",
    label: "Probabilidade de Fecho",
    className: "justify-end tabular-nums",
  },
  { key: "trend", label: "Tendência de Atividade", className: "justify-center" },
  {
    key: "lastInteraction",
    label: "Último Contacto",
    className: "justify-start",
  },
  { key: "action", label: "Ação", className: "justify-center" },
] as const;

export type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];

export const TABLE_GRID_CLASS =
  "grid min-w-max grid-cols-[repeat(9,max-content)] justify-between";

export const TABLE_ROW_CLASS = "col-span-full grid grid-cols-subgrid";

export const TABLE_CELL_CLASS = "flex items-center";

export function columnClass(key: TableColumnKey) {
  return TABLE_COLUMNS.find((column) => column.key === key)?.className ?? "";
}
