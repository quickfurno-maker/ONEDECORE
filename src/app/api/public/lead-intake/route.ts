import "server-only";

import { handleLeadIntakeRequest, safeLeadIntakeLog } from "../../../../features/lead-intake/server/lead-intake-runtime.ts";
import { LeadIntakeError } from "../../../../features/lead-intake/server/lead-intake-errors.ts";
import { getLeadIntakeMode } from "../../../../config/server-env.ts";
import { readBoundedRequestBody } from "../../../../features/lead-intake/server/bounded-request-body.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  headers?: HeadersInit
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();
  let mode: ReturnType<typeof getLeadIntakeMode> | "unknown" = "unknown";
  try {
    mode = getLeadIntakeMode();
  } catch {
    mode = "disabled";
  }

  try {
    const host = request.headers.get("host");
    const bodyResult = await readBoundedRequestBody(request);
    if (!bodyResult.ok) {
      const code =
        bodyResult.code === "INVALID_CONTENT_LENGTH"
          ? "INVALID_CONTENT_LENGTH"
          : "BODY_TOO_LARGE";
      const status = bodyResult.code === "BODY_TOO_LARGE" ? 413 : 400;
      return jsonResponse(status, {
        ok: false,
        code,
        message:
          bodyResult.code === "BODY_TOO_LARGE"
            ? "Request body too large."
            : "Invalid Content-Length.",
      });
    }

    const result = await handleLeadIntakeRequest({
      method: "POST",
      contentType: request.headers.get("content-type"),
      origin: request.headers.get("origin"),
      host,
      rawBody: bodyResult.text,
      remoteAddress:
        // Next does not expose socket reliably; local-test uses loopback default.
        null,
      forwardedFor: request.headers.get("x-forwarded-for"),
      nodeEnv: process.env.NODE_ENV,
    });

    console.info(
      "[lead-intake]",
      JSON.stringify(
        safeLeadIntakeLog({
          correlationId: result.correlationId,
          outcome: result.outcome,
          durationMs: Date.now() - started,
          mode,
          duplicate: result.duplicate,
        })
      )
    );

    const headers: Record<string, string> = {};
    if (result.retryAfterSeconds != null) {
      headers["Retry-After"] = String(result.retryAfterSeconds);
    }

    return jsonResponse(result.httpStatus, result.body, headers);
  } catch (error) {
    if (error instanceof LeadIntakeError) {
      console.info(
        "[lead-intake]",
        JSON.stringify(
          safeLeadIntakeLog({
            correlationId: error.correlationId,
            outcome: error.code,
            durationMs: Date.now() - started,
            mode,
            duplicate: false,
          })
        )
      );
      const headers: Record<string, string> = {};
      if (error.retryAfterSeconds != null) {
        headers["Retry-After"] = String(error.retryAfterSeconds);
      }
      if (error.httpStatus === 405) {
        headers.Allow = "POST";
      }
      return jsonResponse(
        error.httpStatus,
        {
          ok: false,
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
          ...(error.httpStatus >= 500
            ? { correlationId: error.correlationId }
            : {}),
        },
        headers
      );
    }

    const correlationId = crypto.randomUUID();
    console.info(
      "[lead-intake]",
      JSON.stringify(
        safeLeadIntakeLog({
          correlationId,
          outcome: "LEAD_INTAKE_UNAVAILABLE",
          durationMs: Date.now() - started,
          mode,
          duplicate: false,
        })
      )
    );
    return jsonResponse(500, {
      ok: false,
      code: "LEAD_INTAKE_UNAVAILABLE",
      message: "Lead intake is temporarily unavailable.",
      correlationId,
    });
  }
}

export async function GET(): Promise<Response> {
  return jsonResponse(
    405,
    { ok: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
    { Allow: "POST" }
  );
}

export async function PUT(): Promise<Response> {
  return GET();
}

export async function PATCH(): Promise<Response> {
  return GET();
}

export async function DELETE(): Promise<Response> {
  return GET();
}
