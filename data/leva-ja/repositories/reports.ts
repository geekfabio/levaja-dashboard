import type { DateRange } from "./common";

export type ReportKind = "operations" | "finance" | "providers" | "zones" | "business";

export type ReportColumnFormat = "text" | "number" | "kz" | "percent" | "decimal";

export type ReportColumn = { key: string; label: string; format: ReportColumnFormat };

export type Report = {
  kind: ReportKind;
  from: string;
  to: string;
  columns: ReportColumn[];
  rows: (string | number | null)[][];
  summary: { label: string; value: string | number; format: ReportColumnFormat }[];
};

export interface ReportsRepository {
  run(kind: ReportKind, range: Required<DateRange>): Promise<Report>;
}
