export type CsvCell = string | number;

function escapeCell(cell: CsvCell) {
  let value = String(cell);
  if (typeof cell === "string" && /^[=+\-@\t\r]/.test(value)) value = `'${value}`;
  if (/[";,\r\n]/.test(value)) value = `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: CsvCell[][]) {
  return rows.map((row) => row.map(escapeCell).join(";")).join("\r\n");
}

export function downloadCsv(filename: string, rows: CsvCell[][]) {
  saveBlob(filename, new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" }));
}

export function downloadJson(filename: string, value: unknown) {
  saveBlob(filename, new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" }));
}

function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
