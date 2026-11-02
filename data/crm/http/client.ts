import { RepositoryError } from "../repositories/errors";
import type { FieldIssue, RepositoryErrorCode } from "../repositories/errors";

const STATUS_CODES: Record<number, RepositoryErrorCode> = {
  400: "validation",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "invalid_transition",
  422: "validation",
};

const ERROR_CODES: Record<RepositoryErrorCode, true> = {
  network: true,
  not_found: true,
  invalid_transition: true,
  forbidden: true,
  validation: true,
  unauthorized: true,
};

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toRepositoryError(status: number, body: unknown) {
  const payload = typeof body === "object" && body !== null ? (body as { message?: unknown; code?: unknown; issues?: unknown }) : {};
  const code = (typeof payload.code === "string" && payload.code in ERROR_CODES ? payload.code : STATUS_CODES[status] ?? "network") as RepositoryErrorCode;
  const issues = Array.isArray(payload.issues)
    ? payload.issues.filter((issue): issue is FieldIssue => typeof (issue as FieldIssue)?.field === "string" && typeof (issue as FieldIssue)?.message === "string")
    : [];
  const message = typeof payload.message === "string" ? payload.message : "";
  return new RepositoryError(code, message, issues);
}

export type HttpClient = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
};

export function createHttpClient(baseUrl: string, fetchImpl: typeof fetch = fetch): HttpClient {
  const base = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new RepositoryError("network", "");
    }
    const payload = await readBody(response);
    if (!response.ok) throw toRepositoryError(response.status, payload);
    return payload as T;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
  };
}
