import "server-only";

export const LEAD_INTAKE_MAX_BODY_BYTES = 32 * 1024;

export type BoundedBodyResult =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false;
      readonly code: "BODY_TOO_LARGE" | "INVALID_CONTENT_LENGTH";
    };

/**
 * Read a request body with a hard UTF-8 byte cap.
 * Does not trust Content-Length alone; streams and cancels once over limit.
 */
export async function readBoundedRequestBody(
  request: Request,
  maxBytes = LEAD_INTAKE_MAX_BODY_BYTES
): Promise<BoundedBodyResult> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader != null) {
    const contentLength = Number(contentLengthHeader);
    if (
      !Number.isInteger(contentLength) ||
      contentLength < 0 ||
      !Number.isFinite(contentLength)
    ) {
      return { ok: false, code: "INVALID_CONTENT_LENGTH" };
    }
    if (contentLength > maxBytes) {
      try {
        await request.body?.cancel();
      } catch {
        // ignore cancel errors
      }
      return { ok: false, code: "BODY_TOO_LARGE" };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: true, text: "" };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        return { ok: false, code: "BODY_TOO_LARGE" };
      }
      chunks.push(value);
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
    return { ok: false, code: "BODY_TOO_LARGE" };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder("utf-8", { fatal: false }).decode(merged) };
}
