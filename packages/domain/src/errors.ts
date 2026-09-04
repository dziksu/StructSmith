import { ERROR_CODES, type ErrorCode } from "@structsmith/contracts";

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const notFound = (code: ErrorCode, message: string) => new DomainError(code, message, 404);

export const conflict = (message: string, details?: unknown) =>
  new DomainError(ERROR_CODES.REVISION_CONFLICT, message, 409, details);

export const badRequest = (message: string, details?: unknown) =>
  new DomainError(ERROR_CODES.BAD_REQUEST, message, 400, details);

export const ruleViolation = (message: string, details?: unknown) =>
  new DomainError(ERROR_CODES.MODEL_RULE_VIOLATION, message, 422, details);

export const readOnly = (message = "The server is running in read-only mode.") =>
  new DomainError(ERROR_CODES.READ_ONLY, message, 403);
