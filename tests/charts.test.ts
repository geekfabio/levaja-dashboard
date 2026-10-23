import { test } from "node:test";
import assert from "node:assert/strict";
import { axisTicks, median, niceMax, percentChange } from "@/lib/charts";

test("variação percentual sem divisão por zero", () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(10, 0), null);
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
