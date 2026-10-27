import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuery, createHttpRepositories } from "@/data/leva-ja/http";
import { isRepositoryError } from "@/data/leva-ja/repositories";
import type { RepositoryErrorCode } from "@/data/leva-ja/repositories";

type Call = { url: string; init?: RequestInit };

function fakeFetch(status: number, body: unknown, calls: Call[] = []) {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), removeItem: (key: string) => void map.delete(key) };
}

async function rejectsWith(promise: Promise<unknown>, code: RepositoryErrorCode) {
  await assert.rejects(promise, (error: unknown) => isRepositoryError(error) && error.code === code);
}

test("http: filtros convertidos em query string", () => {
  assert.equal(buildQuery({ status: ["searching", "assigned"], zone: [], q: "LJ-1", page: 2, from: undefined }), "?status=searching%2Cassigned&q=LJ-1&page=2");
  assert.equal(buildQuery({}), "");
});

test("http: endpoints do admin e token de sessão", async () => {
  const calls: Call[] = [];
  const storage = memoryStorage();
  const session = { token: "abc", user: { id: "adm-1" }, expiresAt: "2030-01-01T00:00:00Z" };
  const login = createHttpRepositories({ baseUrl: "https://api.angoleva.ao/", fetch: fakeFetch(200, session, calls), storage });
  await login.auth.login("admin@angoleva.ao", "123456");
  const repos = createHttpRepositories({ baseUrl: "https://api.angoleva.ao", fetch: fakeFetch(200, { items: [], total: 0, page: 1, pageSize: 20 }, calls), storage });
  await repos.requests.list({ status: ["searching"], page: 1 });
  await repos.requests.cancel("req-1", "Cliente desistiu");
  assert.equal(calls[0].url, "https://api.angoleva.ao/auth/login");
  assert.equal(calls[1].url, "https://api.angoleva.ao/admin/requests?status=searching&page=1");
  assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, "Bearer abc");
  assert.equal(calls[2].url, "https://api.angoleva.ao/admin/requests/req-1/cancel");
  assert.equal(calls[2].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { reason: "Cliente desistiu" });
});

test("http: erros convertidos em RepositoryError", async () => {
  const storage = memoryStorage();
  const repo = (status: number, body?: unknown) => createHttpRepositories({ baseUrl: "https://api", fetch: fakeFetch(status, body), storage });
  await rejectsWith(repo(409).requests.cancel("req-1", "x"), "invalid_transition");
  await rejectsWith(repo(403).audit.list(), "forbidden");
  await rejectsWith(repo(404).requests.get("x"), "not_found");
  await rejectsWith(repo(401).requests.list(), "unauthorized");
  await rejectsWith(repo(500).requests.list(), "network");
  await assert.rejects(repo(422, { message: "Valor inválido", issues: [{ field: "amount", message: "Demasiado alto" }] }).finance.requestWithdrawal("p", 1), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "validation");
    assert.equal(error.message, "Valor inválido");
    assert.deepEqual(error.issues, [{ field: "amount", message: "Demasiado alto" }]);
    return true;
  });
  const offline = createHttpRepositories({
    baseUrl: "https://api",
    storage,
    fetch: (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch,
  });
  await rejectsWith(offline.requests.list(), "network");
});
