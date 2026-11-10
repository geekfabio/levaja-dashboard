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

test("http: filtros convertidos em query string, em snake_case", () => {
  assert.equal(buildQuery({ status: ["searching", "assigned"], zone: [], q: "LJ-1", page: 2, from: undefined }), "?status=searching%2Cassigned&q=LJ-1&page=2");
  assert.equal(buildQuery({ providerId: "p1", pageSize: 10 }), "?provider_id=p1&page_size=10");
  assert.equal(buildQuery({}), "");
});

test("http: login guarda sessão e csrf; pedidos usam cookies e cabeçalho csrf em mutações", async () => {
  const calls: Call[] = [];
  const storage = memoryStorage();
  const loginResponse = {
    data: {
      token: "sess-1",
      user: { id: "adm-1", name: "Admin", email: "admin@angoleva.ao", role: "admin", active: true },
      expires_at: "2030-01-01T00:00:00Z",
      role_permissions: {},
      csrf_token: "csrf-abc",
    },
  };
  const login = createHttpRepositories({ baseUrl: "https://api.angoleva.ao/", fetch: fakeFetch(200, loginResponse, calls), storage });
  const session = await login.auth.login("admin@angoleva.ao", "123456");
  assert.equal(session.csrfToken, "csrf-abc");
  assert.equal(session.user.id, "adm-1");

  const listResponse = { data: [{ id: "req-1" }], meta: { count: 1, total: 1, page: 1, page_size: 20 } };
  const repos = createHttpRepositories({ baseUrl: "https://api.angoleva.ao", fetch: fakeFetch(200, listResponse, calls), storage });
  const page = await repos.requests.list({ status: ["searching"], page: 1 });
  assert.deepEqual(page, { items: [{ id: "req-1" }], total: 1, page: 1, pageSize: 20 });
  await repos.requests.cancel("req-1", "Cliente desistiu");

  assert.equal(calls[0].url, "https://api.angoleva.ao/admin/auth/login");
  assert.equal(calls[1].url, "https://api.angoleva.ao/admin/requests?status=searching&page=1");
  assert.equal(calls[1].init?.credentials, "include");
  assert.equal(calls[2].url, "https://api.angoleva.ao/admin/requests/req-1/cancel");
  assert.equal(calls[2].init?.method, "POST");
  assert.equal((calls[2].init?.headers as Record<string, string>)["x-csrf-token"], "csrf-abc");
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { reason: "Cliente desistiu" });
});

test("http: erros convertidos em RepositoryError a partir do envelope {error}", async () => {
  const storage = memoryStorage();
  const repo = (status: number, body?: unknown) => createHttpRepositories({ baseUrl: "https://api", fetch: fakeFetch(status, body), storage });
  await rejectsWith(repo(409, { error: { code: "invalid_transition", message: "x" } }).requests.cancel("req-1", "x"), "invalid_transition");
  await rejectsWith(repo(403, { error: { code: "forbidden", message: "x" } }).audit.list(), "forbidden");
  await rejectsWith(repo(404, { error: { code: "not_found", message: "x" } }).requests.get("x"), "not_found");
  await rejectsWith(repo(401, { error: { code: "unauthorized", message: "x" } }).requests.list(), "unauthorized");
  await rejectsWith(repo(500, { error: { code: "server", message: "x" } }).requests.list(), "network");
  await assert.rejects(
    repo(422, { error: { code: "validation", message: "Valor inválido", details: { issues: [{ field: "amount", message: "Demasiado alto" }] } } }).finance.requestWithdrawal("p", 1),
    (error: unknown) => {
      assert.ok(isRepositoryError(error));
      assert.equal(error.code, "validation");
      assert.equal(error.message, "Valor inválido");
      assert.deepEqual(error.issues, [{ field: "amount", message: "Demasiado alto" }]);
      return true;
    },
  );
  const offline = createHttpRepositories({
    baseUrl: "https://api",
    storage,
    fetch: (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch,
  });
  await rejectsWith(offline.requests.list(), "network");
});

test("http: respostas em snake_case chegam convertidas para camelCase", async () => {
  const storage = memoryStorage();
  const body = { data: { client_account_id: "c1", provider_earning_kz: 1000, pickup: { lat: 1, lng: 2 } } };
  const repos = createHttpRepositories({ baseUrl: "https://api", fetch: fakeFetch(200, body), storage });
  const result = await repos.requests.get("req-1");
  assert.deepEqual(result, { clientAccountId: "c1", providerEarningKz: 1000, pickup: { lat: 1, lng: 2 } });
});
