export function dataEnvelope<T>(data: T) {
  return { data };
}

export function listEnvelope<T>(data: T[], meta: Record<string, unknown> = {}) {
  return { data, meta: { count: data.length, ...meta } };
}

export type ErrorCode =
  | "validation"
  | "unauthorized"
  | "token_expired"
  | "forbidden"
  | "not_found"
  | "invalid_transition"
  | "server";

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  validation: 422,
  unauthorized: 401,
  token_expired: 401,
  forbidden: 403,
  not_found: 404,
  invalid_transition: 409,
  server: 500,
};

export function apiError(code: ErrorCode, message: string, details?: Record<string, unknown>) {
  return new ApiError(code, message, STATUS_BY_CODE[code], details);
}
