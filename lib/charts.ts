export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function isNiceStep(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = Number((value / magnitude).toFixed(6));
  return [1, 2, 2.5, 5, 10].includes(normalized);
}

export function axisTicks(max: number) {
  const parts = isNiceStep(max / 4) ? 4 : 5;
  return Array.from({ length: parts + 1 }, (_, index) => (max / parts) * index);
}
