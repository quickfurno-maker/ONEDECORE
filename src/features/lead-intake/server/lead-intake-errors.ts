import "server-only";

export class LeadIntakeError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly fields?: readonly string[];
  readonly retryAfterSeconds?: number;
  readonly correlationId: string;

  constructor(input: {
    code: string;
    message: string;
    httpStatus: number;
    fields?: readonly string[];
    retryAfterSeconds?: number;
    correlationId: string;
  }) {
    super(input.message);
    this.name = "LeadIntakeError";
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.fields = input.fields;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.correlationId = input.correlationId;
  }
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}
