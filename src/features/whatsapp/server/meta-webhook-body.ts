import "server-only";

export const META_WEBHOOK_MAX_BODY_BYTES = 512 * 1024;

export type BoundedRawBodyResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | {
      readonly ok: false;
      readonly code: "BODY_TOO_LARGE" | "INVALID_CONTENT_LENGTH";
    };

/**
 * Read request body as raw bytes with a hard cap.
 * Used for signature verification before JSON parse.
 */
export async function readBoundedRawBody(
  request: Request,
  maxBytes = META_WEBHOOK_MAX_BODY_BYTES
): Promise<BoundedRawBodyResult> {
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
        // ignore
      }
      return { ok: false, code: "BODY_TOO_LARGE" };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: true, bytes: new Uint8Array(0) };
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
  return { ok: true, bytes: merged };
}
