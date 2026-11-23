import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { createHttpRepositories } from "@/data/leva-ja/http/repositories";
import { createMockRepositories } from "@/tests/support/leva-ja-mock";

const API_DIR = join(process.cwd(), "api");
const OTP = "123456";
const NOW = new Date("2026-10-22T13:30:00.000Z");

const hasDatabase = () => Boolean(process.env.DATABASE_URL) || (existsSync(join(API_DIR, ".env")) && /^DATABASE_URL=\S+/m.test(readFileSync(join(API_DIR, ".env"), "utf8")));

type Fixtures = { adminEmail: string; clientIds: string[]; providerIds: string[]; requestIds: string[]; promotionIds: string[] };
type Repos = Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
type Spec = [repo: string, method: string, args: unknown[], ignored?: string[]];

const IGNORED_OPTIONAL: Record<string, string[]> = {
  "requests.list": ["items[].proposal"],
  "requests.get": ["details.", "provider"],
  "integrations.keys": ["[].lastUsedAt", "[].expiresAt", "[].revokedAt", "[].revokedBy", "[].revokeReason"],
  "communications.list": ["items[].subject", "items[].sentAt", "items[].recipients", "items[].delivered", "items[].failed"],
  "operations.scheduled": ["items[].details.", "items[].provider", "items[].proposal"],
  "applications.list": ["items[].fleetId", "items[].interviewAt", "items[].inspection"],
  "quality.scores": ["items[].fleetId"],
  "disputes.list": ["items[].request.details.", "items[].request.photos", "items[].request.provider", "items[].request.proof", "items[].request.proposal"],
  "providers.requests": ["items[].details."],
  "billing.settlements": ["items[].reference", "items[].receivedAt", "items[].resolution", "items[].resolvedBy", "items[].resolvedAt"],
  "support.sosAlerts": ["[].acknowledgedAt", "[].resolvedAt", "[].handledBy", "[].resolution"],
  "support.lowRatings": ["items[].handledNote"],
  "metrics.attention": ["stalledSearching[].details.", "stalledSearching[].provider", "scheduledAtRisk[].details.", "scheduledAtRisk[].provider", "openSos[].acknowledgedAt", "openSos[].resolvedAt", "openSos[].handledBy", "openSos[].resolution", "openDisputes[].photos", "openDisputes[].details.", "openDisputes[].provider", "openDisputes[].proof", "openDisputes[].proposal"],
};

function paths(value: unknown, prefix = "", out = new Set<string>(), emptyArrays = new Set<string>()) {
  if (Array.isArray(value)) {
    if (!value.length) emptyArrays.add(prefix);
    for (const item of value) paths(item, `${prefix}[]`, out, emptyArrays);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const next = prefix ? `${prefix}.${key}` : key;
      out.add(next);
      paths(item, next, out, emptyArrays);
    }
  }
  return { out, emptyArrays };
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

function startApi(port: number) {
  return new Promise<ChildProcess>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: API_DIR,
      env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", OTP_FIXED_CODE: OTP, NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => reject(new Error("A API não arrancou a tempo.")), 60_000);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes("Server listening")) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout!.on("data", onData);
    child.stderr!.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`A API terminou com o código ${code}.`));
    });
  });
}

function cookieJarFetch(): typeof fetch {
  const jar = new Map<string, string>();
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (jar.size) headers.set("cookie", [...jar].map(([key, value]) => `${key}=${value}`).join("; "));
    const response = await fetch(input, { ...init, headers });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const index = pair!.indexOf("=");
      jar.set(pair!.slice(0, index), pair!.slice(index + 1));
    }
    return response;
  };
}

function memoryStorage() {
  const store = new Map<string, string>();
  return { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key) };
}

const skip = hasDatabase() ? false : "sem DATABASE_URL: o teste de contrato precisa da base de dados da API";

let api: ChildProcess | undefined;
let fixtures: Fixtures | undefined;
let real: Repos;
let mock: Repos;

before(async () => {
  if (skip) return;
  const created = execFileSync(process.execPath, ["--import", "tsx", "tests/helpers/panel-fixtures.ts", "create"], { cwd: API_DIR, encoding: "utf8", env: process.env });
  fixtures = JSON.parse(created.trim().split("\n").at(-1)!) as Fixtures;
  const port = await freePort();
  api = await startApi(port);
  const repos = createHttpRepositories({ baseUrl: `http://127.0.0.1:${port}`, fetch: cookieJarFetch(), storage: memoryStorage() });
  await repos.auth.requestCode(fixtures.adminEmail);
  await repos.auth.login(fixtures.adminEmail, OTP);
  real = repos as unknown as Repos;
  const mocked = createMockRepositories({ now: () => NOW, latencyMs: 0, storage: null, tickMs: 0 });
  await mocked.auth.login("admin@angoleva.ao", "123456");
  mock = mocked as unknown as Repos;
});

after(() => {
  api?.kill("SIGTERM");
  if (fixtures) execFileSync(process.execPath, ["--import", "tsx", "tests/helpers/panel-fixtures.ts", "cleanup", JSON.stringify(fixtures)], { cwd: API_DIR, encoding: "utf8", env: process.env });
});

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function specs(side: "real" | "mock", ids: Record<string, string>): Spec[] {
  const range = side === "real" ? { from: day(-30), to: day(0) } : { from: "2026-09-22", to: "2026-10-22" };
  return [
    ["auth", "listUsers", []],
    ["requests", "list", [{ pageSize: 20 }]],
    ["requests", "get", [ids.request]],
    ["requests", "active", []],
    ["privacy", "list", []],
    ["privacy", "summary", []],
    ["security", "sessions", []],
    ["security", "accessLog", []],
    ["integrations", "keys", []],
    ["integrations", "webhooks", []],
    ["business", "list", []],
    ["business", "candidates", []],
    ["promotions", "list", []],
    ["promotions", "get", [ids.promotion]],
    ["communications", "list", []],
    ["operations", "scheduled", []],
    ["operations", "sla", [range]],
    ["operations", "heatmap", [{ kind: "demand", days: 14 }]],
    ["claims", "list", []],
    ["claims", "summary", []],
    ["applications", "list", []],
    ["applications", "summary", []],
    ["fleets", "list", []],
    ["quality", "scores", []],
    ["quality", "penalties", []],
    ["disputes", "list", []],
    ["disputes", "summary", []],
    ["refunds", "list", []],
    ["refunds", "summary", []],
    ["providers", "list", []],
    ["providers", "get", [ids.provider]],
    ["providers", "transactions", [ids.provider]],
    ["providers", "reviews", [ids.provider]],
    ["providers", "requests", [ids.provider]],
    ["providers", "positions", []],
    ["documents", "queue", []],
    ["clients", "list", []],
    ["clients", "get", [ids.client]],
    ["clients", "requests", [ids.client]],
    ["finance", "revenue", [range]],
    ["finance", "withdrawals", []],
    ["finance", "transactions", []],
    ["finance", "batches", []],
    ["billing", "invoices", []],
    ["billing", "settlements", [range]],
    ["billing", "cashDebts", []],
    ["pricing", "get", []],
    ["zones", "list", []],
    ["support", "assignees", []],
    ["support", "tickets", []],
    ["support", "sosAlerts", []],
    ["support", "lowRatings", []],
    ["support", "responseSummary", []],
    ["support", "satisfaction", []],
    ["support", "emergencyContacts", []],
    ["metrics", "overview", [range]],
    ["metrics", "attention", []],
    ["audit", "list", []],
    ["settings", "get", []],
    ["settings", "rolePermissions", []],
  ];
}

async function firstId(repos: Repos, repo: string) {
  const result = (await repos[repo]!.list!()) as { items?: { id: string }[] } | { id: string }[];
  return (Array.isArray(result) ? result : result.items)?.[0]?.id;
}

test("contrato: cada leitura da API real tem as chaves do repositório de referência", { skip }, async () => {
  const realIds = { request: fixtures!.requestIds[4]!, provider: fixtures!.providerIds[0]!, client: fixtures!.clientIds[0]!, promotion: fixtures!.promotionIds[0]! };
  const mockIds = { request: (await firstId(mock, "requests"))!, provider: (await firstId(mock, "providers"))!, client: (await firstId(mock, "clients"))!, promotion: (await firstId(mock, "promotions"))! };
  const realSpecs = specs("real", realIds);
  const mockSpecs = specs("mock", mockIds);
  const failures: string[] = [];
  for (const [index, [repo, method, args]] of realSpecs.entries()) {
    const label = `${repo}.${method}`;
    const realValue = await real[repo]![method]!(...args).catch((error: unknown) => {
      failures.push(`${label}: a API real falhou (${(error as Error).message})`);
      return undefined;
    });
    if (realValue === undefined) continue;
    const mockValue = await mock[repo]![method]!(...mockSpecs[index]![2]);
    const realPaths = paths(realValue);
    const mockPaths = paths(mockValue);
    const ignored = IGNORED_OPTIONAL[label] ?? [];
    const missing = [...mockPaths.out].filter(
      (path) => !realPaths.out.has(path) && ![...realPaths.emptyArrays].some((empty) => path.startsWith(`${empty}[]`)) && !ignored.some((prefix) => path.startsWith(prefix)),
    );
    if (missing.length) failures.push(`${label}: faltam ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ` (+${missing.length - 12})` : ""}`);
  }
  assert.deepEqual(failures, []);
});

test("contrato: escrita rejeitada devolve RepositoryError com código", { skip }, async () => {
  await assert.rejects(real.requests!.get!("req_inexistente"), (error: unknown) => (error as { code?: string }).code === "not_found");
});
