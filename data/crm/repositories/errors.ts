export type RepositoryErrorCode =
  | "network"
  | "not_found"
  | "invalid_transition"
  | "forbidden"
  | "validation"
  | "unauthorized";

export type FieldIssue = { field: string; message: string };

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly issues: FieldIssue[];

  constructor(code: RepositoryErrorCode, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.issues = issues;
  }
}

export function isRepositoryError(error: unknown): error is RepositoryError {
  return error instanceof RepositoryError;
}

export const ERROR_FALLBACK_MESSAGES: Record<RepositoryErrorCode, string> = {
  network: "Não foi possível contactar o servidor. Verifique a ligação e tente novamente.",
  not_found: "O registo pedido não existe ou foi removido.",
  invalid_transition: "Esta acção não é permitida no estado actual.",
  forbidden: "Não tem permissão para esta acção.",
  validation: "Há campos com valores inválidos.",
  unauthorized: "A sessão expirou. Inicie sessão novamente.",
};

export function errorMessage(error: unknown) {
  if (isRepositoryError(error)) return error.message || ERROR_FALLBACK_MESSAGES[error.code];
  return ERROR_FALLBACK_MESSAGES.network;
}
