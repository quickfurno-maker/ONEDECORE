import "server-only";

import {
  handleMetaWebhookPost,
  handleMetaWebhookVerification,
  MetaWebhookError,
  safeMetaWebhookLog,
} from "../../../../../features/whatsapp/server/meta-webhook-ingest.ts";
import { readBoundedRawBody } from "../../../../../features/whatsapp/server/meta-webhook-body.ts";
import { getMetaWebhookMode } from "../../../../../features/whatsapp/server/meta-webhook-env.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function textResponse(
  status: number,
  body: string,
  contentType = "text/plain; charset=utf-8"
): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const started = Date.now();
  let mode: ReturnType<typeof getMetaWebhookMode> | "unknown" = "unknown";
  try {
    mode = getMetaWebhookMode();
  } catch {
    mode = "disabled";
  }

  const url = new URL(request.url);
  try {
    const result = handleMetaWebhookVerification({
      mode,
      verifyToken: null,
      hubMode: url.searchParams.get("hub.mode"),
      hubVerifyToken: url.searchParams.get("hub.verify_token"),
      hubChallenge: url.searchParams.get("hub.challenge"),
      host: request.headers.get("host"),
    });

    console.info(
      "[meta-whatsapp-webhook]",
      JSON.stringify(
        safeMetaWebhookLog({
          correlationId: result.correlationId,
          outcome: result.outcome,
          durationMs: Date.now() - started,
          mode,
          eventCount: result.eventCount,
        })
      )
    );

    return textResponse(result.httpStatus, result.body, result.contentType);
  } catch (error) {
    if (error instanceof MetaWebhookError) {
      console.info(
        "[meta-whatsapp-webhook]",
        JSON.stringify(
          safeMetaWebhookLog({
            correlationId: error.correlationId,
            outcome: error.code,
            durationMs: Date.now() - started,
            mode,
            eventCount: 0,
          })
        )
      );
      if (error.httpStatus === 200) {
        return textResponse(200, "");
      }
      return jsonResponse(error.httpStatus, {
        ok: false,
        code: error.code,
        message: error.message,
      });
    }

    const correlationId = crypto.randomUUID();
    console.info(
      "[meta-whatsapp-webhook]",
      JSON.stringify(
        safeMetaWebhookLog({
          correlationId,
          outcome: "WEBHOOK_UNAVAILABLE",
          durationMs: Date.now() - started,
          mode,
          eventCount: 0,
        })
      )
    );
    return jsonResponse(500, {
      ok: false,
      code: "WEBHOOK_UNAVAILABLE",
      message: "WhatsApp webhook is temporarily unavailable.",
      correlationId,
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now();
  let mode: ReturnType<typeof getMetaWebhookMode> | "unknown" = "unknown";
  try {
    mode = getMetaWebhookMode();
  } catch {
    mode = "disabled";
  }

  try {
    const bodyResult = await readBoundedRawBody(request);
    if (!bodyResult.ok) {
      const status = bodyResult.code === "BODY_TOO_LARGE" ? 413 : 400;
      return jsonResponse(status, {
        ok: false,
        code: bodyResult.code,
        message:
          bodyResult.code === "BODY_TOO_LARGE"
            ? "Request body too large."
            : "Invalid Content-Length.",
      });
    }

    const result = await handleMetaWebhookPost({
      contentType: request.headers.get("content-type"),
      signatureHeader: request.headers.get("x-hub-signature-256"),
      rawBody: bodyResult.bytes,
      host: request.headers.get("host"),
      nodeEnv: process.env.NODE_ENV,
    });

    console.info(
      "[meta-whatsapp-webhook]",
      JSON.stringify(
        safeMetaWebhookLog({
          correlationId: result.correlationId,
          outcome: result.outcome,
          durationMs: Date.now() - started,
          mode,
          eventCount: result.eventCount,
        })
      )
    );

    return textResponse(result.httpStatus, result.body, result.contentType);
  } catch (error) {
    if (error instanceof MetaWebhookError) {
      console.info(
        "[meta-whatsapp-webhook]",
        JSON.stringify(
          safeMetaWebhookLog({
            correlationId: error.correlationId,
            outcome: error.code,
            durationMs: Date.now() - started,
            mode,
            eventCount: 0,
          })
        )
      );
      return jsonResponse(error.httpStatus, {
        ok: false,
        code: error.code,
        message: error.message,
        ...(error.httpStatus >= 500
          ? { correlationId: error.correlationId }
          : {}),
      });
    }

    const correlationId = crypto.randomUUID();
    console.info(
      "[meta-whatsapp-webhook]",
      JSON.stringify(
        safeMetaWebhookLog({
          correlationId,
          outcome: "WEBHOOK_UNAVAILABLE",
          durationMs: Date.now() - started,
          mode,
          eventCount: 0,
        })
      )
    );
    return jsonResponse(500, {
      ok: false,
      code: "WEBHOOK_UNAVAILABLE",
      message: "WhatsApp webhook is temporarily unavailable.",
      correlationId,
    });
  }
}

export async function PUT(): Promise<Response> {
  return jsonResponse(405, {
    ok: false,
    code: "METHOD_NOT_ALLOWED",
    message: "Method not allowed.",
  });
}

export async function PATCH(): Promise<Response> {
  return PUT();
}

export async function DELETE(): Promise<Response> {
  return PUT();
}
