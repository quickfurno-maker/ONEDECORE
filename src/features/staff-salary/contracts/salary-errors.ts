/** Workforce V1 — salary error vocabulary and Postgres token mapping. */

export const SALARY_ERROR_CODES = [
  "SALARY_UNAUTHORIZED",
  "SALARY_PERMISSION_DENIED",
  "SALARY_STAFF_NOT_FOUND",
  "SALARY_PROFILE_MISSING",
  "SALARY_AMOUNT_INVALID",
  "SALARY_EFFECTIVE_FROM_REQUIRED",
  "SALARY_EFFECTIVE_FROM_NOT_AFTER_CURRENT",
  "SALARY_STATEMENT_NOT_FOUND",
  "SALARY_STATEMENT_EXISTS",
  "SALARY_STATEMENT_FINALIZED",
  "SALARY_STATEMENT_NOT_FINALIZED",
  "SALARY_LINE_TYPE_INVALID",
  "SALARY_LINE_NOT_FOUND",
  "SALARY_NET_NEGATIVE",
  "SALARY_PAYMENT_METHOD_INVALID",
  "SALARY_PAYMENT_EXCEEDS_BALANCE",
  "SALARY_REASON_REQUIRED",
  "SALARY_RPC_FAILED",
] as const;

export type SalaryErrorCode = (typeof SALARY_ERROR_CODES)[number];

const SALARY_ERROR_MESSAGES: Record<SalaryErrorCode, string> = {
  SALARY_UNAUTHORIZED: "Authentication required.",
  SALARY_PERMISSION_DENIED: "Only a Super Admin can manage salary.",
  SALARY_STAFF_NOT_FOUND: "Employee not found.",
  SALARY_PROFILE_MISSING:
    "No salary is set for this employee in that month. Set a salary first.",
  SALARY_AMOUNT_INVALID: "Enter a valid amount greater than zero.",
  SALARY_EFFECTIVE_FROM_REQUIRED: "An effective-from date is required.",
  SALARY_EFFECTIVE_FROM_NOT_AFTER_CURRENT:
    "A new salary version must start after the current version begins.",
  SALARY_STATEMENT_NOT_FOUND: "Salary statement not found.",
  SALARY_STATEMENT_EXISTS: "A statement already exists for this employee and month.",
  SALARY_STATEMENT_FINALIZED:
    "This statement is finalized. Reopen it with a reason before changing it.",
  SALARY_STATEMENT_NOT_FINALIZED:
    "Finalize the statement before recording a payment.",
  SALARY_LINE_TYPE_INVALID: "Choose a valid addition or deduction type.",
  SALARY_LINE_NOT_FOUND: "Statement line not found.",
  SALARY_NET_NEGATIVE: "Net payable cannot be negative.",
  SALARY_PAYMENT_METHOD_INVALID: "Choose bank, UPI, cash or other.",
  SALARY_PAYMENT_EXCEEDS_BALANCE:
    "This payment is larger than the remaining balance.",
  SALARY_REASON_REQUIRED: "A reason is required (1–500 characters).",
  SALARY_RPC_FAILED: "Salary operation failed.",
};

const SALARY_ERROR_HTTP: Record<SalaryErrorCode, number> = {
  SALARY_UNAUTHORIZED: 401,
  SALARY_PERMISSION_DENIED: 403,
  SALARY_STAFF_NOT_FOUND: 404,
  SALARY_PROFILE_MISSING: 422,
  SALARY_AMOUNT_INVALID: 422,
  SALARY_EFFECTIVE_FROM_REQUIRED: 422,
  SALARY_EFFECTIVE_FROM_NOT_AFTER_CURRENT: 422,
  SALARY_STATEMENT_NOT_FOUND: 404,
  SALARY_STATEMENT_EXISTS: 409,
  SALARY_STATEMENT_FINALIZED: 409,
  SALARY_STATEMENT_NOT_FINALIZED: 409,
  SALARY_LINE_TYPE_INVALID: 422,
  SALARY_LINE_NOT_FOUND: 404,
  SALARY_NET_NEGATIVE: 422,
  SALARY_PAYMENT_METHOD_INVALID: 422,
  SALARY_PAYMENT_EXCEEDS_BALANCE: 422,
  SALARY_REASON_REQUIRED: 422,
  SALARY_RPC_FAILED: 500,
};

export class SalaryError extends Error {
  readonly code: SalaryErrorCode;
  readonly httpStatus: number;
  readonly details?: string;

  constructor(input: { code: SalaryErrorCode; details?: string }) {
    super(SALARY_ERROR_MESSAGES[input.code]);
    this.name = "SalaryError";
    this.code = input.code;
    this.httpStatus = SALARY_ERROR_HTTP[input.code];
    this.details = input.details;
  }
}

export function createSalaryError(code: SalaryErrorCode, details?: string): SalaryError {
  return new SalaryError({ code, details });
}

/** Maps the RPC exception tokens onto the client vocabulary by exact token. */
export function salaryErrorFromPostgresMessage(message: string): SalaryError {
  const token = SALARY_ERROR_CODES.find((code) => message.includes(code));
  if (token) {
    return createSalaryError(token, message);
  }

  if (message.includes("42501") || message.toLowerCase().includes("permission denied")) {
    return createSalaryError("SALARY_PERMISSION_DENIED", message);
  }

  return createSalaryError("SALARY_RPC_FAILED", message);
}

export function isSalaryErrorCode(value: string): value is SalaryErrorCode {
  return (SALARY_ERROR_CODES as readonly string[]).includes(value);
}
