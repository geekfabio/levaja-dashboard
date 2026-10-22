import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPANIES } from "@/data/companies";
import type { Sale } from "@/data/sales";
import {
  axisTicks,
  ANY,
  dailySeries,
  debtAging,
  median,
  niceMax,
  paymentMix,
  percentChange,
  periodRanges,
  scopeSales,
  weekdayHourHeatmap,
  weeklyByChannel,
  zoneComparison,
} from "@/lib/analytics";

function sale(at: string, total: number, extra: Partial<Sale> = {}): Sale {
  return {
    id: at,
    document: at,
    at,
    channel: "Loja Viana",
    payment: "Numerário",
    companyId: COMPANIES[0].id,
    lines: [],
    total,
    paid: true,
    source: "Simulação",
    ...extra,
  };
}

test("períodos atual e anterior com o mesmo número de dias", () => {
  assert.deepEqual(periodRanges("2026-10-14", 30), {
    current: { from: "2026-09-15", to: "2026-10-14" },
    previous: { from: "2026-08-16", to: "2026-09-14" },
  });
});

test("variação percentual sem divisão por zero", () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(10, 0), null);
});

test("série diária inclui dias sem vendas e média móvel", () => {
  const points = dailySeries([sale("2026-10-01T10:00", 700), sale("2026-10-03T10:00", 700)], { from: "2026-10-01", to: "2026-10-03" }, 3);
  assert.deepEqual(points.map((point) => point.total), [700, 0, 700]);
  assert.deepEqual(points.map((point) => point.average), [700, 350, 467]);
});

test("semanas começam à segunda-feira e somam por canal", () => {
  const weeks = weeklyByChannel(
    [sale("2026-10-12T10:00", 100), sale("2026-10-14T10:00", 50, { channel: "Entrega" })],
    { from: "2026-10-12", to: "2026-10-14" },
  );
  assert.equal(weeks[0].week, "2026-10-12");
  assert.equal(weeks[0].values["Loja Viana"], 100);
  assert.equal(weeks[0].values.Entrega, 50);
  assert.equal(weeks[0].total, 150);
});

test("mapa de calor por dia da semana e hora", () => {
  const cells = weekdayHourHeatmap([sale("2026-10-12T10:30", 100), sale("2026-10-12T10:10", 50)]);
  const monday10 = cells.find((cell) => cell.day === 0 && cell.hour === 10)!;
  assert.equal(monday10.count, 2);
  assert.equal(monday10.total, 150);
});

test("mistura de pagamentos soma 100%", () => {
  const mix = paymentMix([sale("2026-10-01T10:00", 300), sale("2026-10-01T11:00", 100, { payment: "Crédito" })]);
  assert.equal(Math.round(mix.reduce((sum, item) => sum + item.share, 0) * 100), 100);
  assert.equal(mix.find((item) => item.key === "Crédito")!.share, 0.25);
});

test("filtro por zona deixa de fora as vendas de outras zonas e sem cliente", () => {
  const other = COMPANIES.find((company) => company.zone !== COMPANIES[0].zone)!;
  const sales = [sale("2026-10-01T10:00", 1), sale("2026-10-01T10:00", 2, { companyId: other.id }), sale("2026-10-01T10:00", 3, { companyId: undefined })];
  assert.equal(scopeSales(sales, COMPANIES, { zone: ANY, segment: ANY }).length, 3);
  assert.deepEqual(scopeSales(sales, COMPANIES, { zone: COMPANIES[0].zone, segment: ANY }).map((item) => item.total), [1]);
});

test("comparação por zona com o período anterior", () => {
  const [row] = zoneComparison([sale("2026-10-01T10:00", 150)], [sale("2026-09-01T10:00", 100)], COMPANIES, [COMPANIES[0].zone]);
  assert.equal(row.change, 50);
});

test("envelhecimento da dívida só conta crédito por pagar", () => {
  const buckets = debtAging(
    [
      sale("2026-10-01T10:00", 100, { payment: "Crédito", paid: false }),
      sale("2026-07-01T10:00", 200, { payment: "Crédito", paid: false }),
      sale("2026-07-01T10:00", 999, { payment: "Crédito", paid: true }),
    ],
    "2026-10-14",
  );
  assert.deepEqual(buckets.map((bucket) => bucket.total), [100, 0, 0, 200]);
});

test("mediana e topo arredondado do eixo", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(niceMax(73_000), 100_000);
  assert.equal(niceMax(1_800_000), 2_000_000);
  assert.equal(niceMax(240), 250);
});

test("marcas do eixo caem em valores redondos", () => {
  assert.deepEqual(axisTicks(5_000_000), [0, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000]);
  assert.deepEqual(axisTicks(20_000_000), [0, 5_000_000, 10_000_000, 15_000_000, 20_000_000]);
  assert.deepEqual(axisTicks(100), [0, 25, 50, 75, 100]);
});
