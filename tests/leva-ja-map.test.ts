import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterByGrid, fitView, fromScreen, metersPerPixel, niceScale, project, toScreen, unproject, visibleTiles, zoomAround } from "@/lib/map-projection";
import { estimateRoute, routePlan } from "@/lib/leva-ja/routing";
import { createOsrmRouting, parseOsrmRoute } from "@/data/leva-ja/http/routing";
import { createMockRepositories } from "@/data/leva-ja/mock";

const LUANDA = { latitude: -8.8147, longitude: 13.2302 };
const SIZE = { width: 800, height: 600 };

test("mapa: projecção Web Mercator ida e volta", () => {
  const point = project(LUANDA, 12);
  const back = unproject(point, 12);
  assert.ok(Math.abs(back.latitude - LUANDA.latitude) < 1e-9);
  assert.ok(Math.abs(back.longitude - LUANDA.longitude) < 1e-9);
  assert.deepEqual(project({ latitude: 0, longitude: 0 }, 0), { x: 128, y: 128 });
});

test("mapa: o centro fica no meio do ecrã e o zoom mantém o ponto sob o cursor", () => {
  assert.deepEqual(toScreen(LUANDA, LUANDA, 10, SIZE), { x: 400, y: 300 });
  const anchor = { x: 120, y: 80 };
  const under = fromScreen(anchor, LUANDA, 10, SIZE);
  const center = zoomAround(LUANDA, 10, 12, anchor, SIZE);
  const after = toScreen(under, center, 12, SIZE);
  assert.ok(Math.abs(after.x - anchor.x) < 1e-6 && Math.abs(after.y - anchor.y) < 1e-6);
});

test("mapa: tiles cobrem o ecrã e o enquadramento cabe na área", () => {
  const tiles = visibleTiles(LUANDA, 12, SIZE);
  assert.ok(tiles.length >= 12 && tiles.length <= 30);
  assert.ok(tiles.every((tile) => tile.z === 12 && tile.x >= 0 && tile.y >= 0));
  const view = fitView([LUANDA, { latitude: -8.9965, longitude: 13.2715 }], SIZE);
  assert.ok(view && view.zoom >= 11 && view.zoom <= 13);
  assert.ok(metersPerPixel(0, 0) > 156_000);
});

test("rotas: estimativa usa factor de estrada e é mais lenta para camiões", () => {
  const points = [LUANDA, { latitude: -8.9175, longitude: 13.1834 }];
  const car = estimateRoute(points, "pickup");
  const truck = estimateRoute(points, "truck");
  assert.equal(car.source, "estimate");
  assert.ok(car.distanceKm > 12 && car.distanceKm < 20);
  assert.ok(truck.durationMin > car.durationMin);
});

const AIRPORT = { latitude: -8.8584, longitude: 13.2312 };
const OSRM_BODY = {
  code: "Ok",
  routes: [
    {
      distance: 7340,
      duration: 840,
      geometry: { coordinates: [[13.2302, -8.8147], [13.2351, -8.83], [13.2312, -8.8584]] as [number, number][] },
      legs: [{ distance: 7340, duration: 840 }],
    },
  ],
};

function fakeFetch(body: unknown, calls: string[], ok = true) {
  return (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status: ok ? 200 : 503 });
  }) as typeof fetch;
}

test("rotas: resposta OSRM vira km, minutos e geometria por estrada", () => {
  const route = parseOsrmRoute(OSRM_BODY, 1.25);
  assert.ok(route);
  assert.equal(route.source, "road");
  assert.equal(route.distanceKm, 7.3);
  assert.equal(route.durationMin, 18);
  assert.equal(route.geometry.length, 3);
  assert.deepEqual(route.geometry[0], LUANDA);
  assert.equal(parseOsrmRoute({ code: "NoRoute" }), null);
});

test("rotas: OSRM pede longitude,latitude, guarda em cache e recorre à estimativa se falhar", async () => {
  const calls: string[] = [];
  const routing = createOsrmRouting({ baseUrl: "https://osrm.test/", fetch: fakeFetch(OSRM_BODY, calls) });
  const first = await routing.route([LUANDA, AIRPORT], { vehicleClass: "pickup" });
  const again = await routing.route([LUANDA, AIRPORT], { vehicleClass: "pickup" });
  assert.equal(first.source, "road");
  assert.equal(again, first);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/osrm\.test\/route\/v1\/driving\/13\.230200,-8\.814700;13\.231200,-8\.858400\?overview=full&geometries=geojson/);

  const failing: string[] = [];
  const offline = createOsrmRouting({ baseUrl: "https://osrm.test", fetch: fakeFetch({}, failing, false) });
  const estimate = await offline.route([LUANDA, AIRPORT], { vehicleClass: "truck" });
  assert.equal(estimate.source, "estimate");
  assert.deepEqual(estimate, estimateRoute([LUANDA, AIRPORT], "truck"));
  await offline.route([LUANDA, AIRPORT], { vehicleClass: "truck" });
  assert.equal(failing.length, 2);
});

test("rotas: plano liga o prestador à recolha antes de recolher e à entrega em transporte", () => {
  const place = (coords: typeof LUANDA) => ({ id: "p", label: "", area: "", city: "Luanda", coords });
  const provider = { coords: { latitude: -8.8, longitude: 13.3 } } as Parameters<typeof routePlan>[0]["provider"];
  const base = { origin: place(LUANDA), destination: place(AIRPORT), stops: [], provider };
  assert.deepEqual(routePlan({ ...base, status: "en_route" }).approach, [provider?.coords, LUANDA]);
  assert.deepEqual(routePlan({ ...base, status: "in_transit" }), { approach: null, trip: [provider?.coords, AIRPORT] });
  assert.deepEqual(routePlan({ ...base, status: "searching", provider: undefined }), { approach: null, trip: [LUANDA, AIRPORT] });
});

test("mapa: agrupamento por grelha e escala arredondada", () => {
  const items = [{ point: { x: 10, y: 10 } }, { point: { x: 30, y: 20 } }, { point: { x: 200, y: 200 } }];
  const groups = clusterByGrid(items, 44);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].point, { x: 20, y: 15 });
  const scale = niceScale(37.5, 96);
  assert.equal(scale.meters, 2000);
  assert.ok(scale.width <= 96);
});

test("mapa: posições dos prestadores trazem a classe da viatura", async () => {
  const NOW = new Date("2026-05-12T10:00:00Z");
  const calls: string[] = [];
  const repos = createMockRepositories({ now: () => NOW, latencyMs: 0, storage: null, tickMs: 0, routing: createOsrmRouting({ fetch: fakeFetch(OSRM_BODY, calls) }) });
  await repos.auth.requestCode("operacoes@angoleva.ao");
  await repos.auth.login("operacoes@angoleva.ao", "123456");
  const positions = await repos.providers.positions();
  assert.ok(positions.length > 0);
  assert.ok(positions.every((position) => ["tow_truck", "pickup", "van", "truck"].includes(position.vehicleClass)));
  const route = await repos.routing.route([LUANDA, AIRPORT]);
  assert.equal(route.source, "road");
});
