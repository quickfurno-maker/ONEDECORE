/**
 * Same-origin POST client for public lead intake — no PII logging.
 */

import type { LeadIntakeRequestBody } from "../contracts.ts";

const LEAD_INTAKE_ENDPOINT = "/api/public/lead-intake";
const REQUEST_TIMEOUT_MS = 20_000;

export type LeadIntakeClientResult =
  | {
      readonly kind: "success-created";
      readonly submissionReference?: string;
    }
  | {
      readonly kind: "success-duplicate";
      readonly submissionReference?: string;
    }
  | {
      readonly kind: "validation-error";
      readonly fields?: readonly string[];
      readonly correlationId?: string;
    }
  | { readonly kind: "conflict" }
  | {
      readonly kind: "rate-limited";
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: "disabled" }
  | { readonly kind: "payload-too-large" }
  | {
      readonly kind: "unavailable";
      readonly correlationId?: string;
    }
  | { readonly kind: "network" }
  | { readonly kind: "timeout" };

interface ApiBody {
  readonly ok?: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly submissionReference?: string;
  readonly duplicate?: boolean;
  readonly fields?: readonly string[];
  readonly correlationId?: string;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function safeParseJson(text: string): ApiBody | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as ApiBody;
    }
    return null;
  } catch {
    return null;
  }
}

function mapHttpStatus(
  status: number,
  body: ApiBody | null,
  retryAfterSeconds?: number
): LeadIntakeClientResult {
  const code = body?.code;

  if (status === 201 && body?.ok === true) {
    return {
      kind: "success-created",
      submissionReference: body.submissionReference,
    };
  }

  if (status === 200 && body?.ok === true && body.duplicate === true) {
    return {
      kind: "success-duplicate",
      submissionReference: body.submissionReference,
    };
  }

  if (status === 400) {
    return {
      kind: "validation-error",
      fields: body?.fields,
      correlationId: body?.correlationId,
    };
  }

  if (status === 409 || code === "IDEMPOTENCY_CONFLICT") {
    return { kind: "conflict" };
  }

  if (status === 413 || code === "BODY_TOO_LARGE") {
    return { kind: "payload-too-large" };
  }

  if (status === 429) {
    return {
      kind: "rate-limited",
      retryAfterSeconds,
    };
  }

  if (status === 503 || code === "LEAD_INTAKE_DISABLED") {
    return { kind: "disabled" };
  }

  if (status >= 500) {
    return {
      kind: "unavailable",
      correlationId: body?.correlationId,
    };
  }

  return { kind: "unavailable", correlationId: body?.correlationId };
}

export async function submitLeadIntake(
  body: LeadIntakeRequestBody,
  options?: {
    readonly fetchImpl?: typeof fetch;
    readonly timeoutMs?: number;
  }
): Promise<LeadIntakeClientResult & { readonly httpStatus: number | null }> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(LEAD_INTAKE_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json; charset=utf-8",
        accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const retryAfterSeconds = parseRetryAfter(
      response.headers.get("Retry-After")
    );
    const text = await response.text();
    const parsed = text ? safeParseJson(text) : null;
    const result = mapHttpStatus(response.status, parsed, retryAfterSeconds);
    return { ...result, httpStatus: response.status };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { kind: "timeout", httpStatus: null };
    }
    return { kind: "network", httpStatus: null };
  } finally {
    clearTimeout(timer);
  }
}
