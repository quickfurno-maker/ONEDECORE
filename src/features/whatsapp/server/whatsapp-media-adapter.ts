import "server-only";

import { createHash } from "node:crypto";
import {
  isAllowedWhatsappMediaDownloadUrl,
  normalizeWhatsappMimeType,
  validateWhatsappOutboundMedia,
  type WhatsappMediaKind,
} from "../contracts/media-policy.ts";
import type { WhatsappBusinessServerEnv } from "./whatsapp-business-env.ts";
import { buildMetaGraphUrl } from "./whatsapp-graph-url.ts";

/**
 * WM-2 — official Cloud API media adapter.
 *
 *   retrieve  GET  /{version}/{media-id}            -> short-lived CDN url + metadata
 *   download  GET  {url}                            -> bytes, allowlisted host only
 *   upload    POST /{version}/{phone-number-id}/media -> media id for sending by ID
 *
 * SSRF: the only URL ever fetched that did not come from `buildMetaGraphUrl`
 * is the CDN url Meta returned, and it must pass
 * `isAllowedWhatsappMediaDownloadUrl` before a byte is requested. Redirects
 * are not followed. Bodies are read with a hard byte ceiling. The bearer token
 * is sent to Graph and to the Meta CDN only.
 */

export type WhatsappMediaFailure = {
  readonly kind: "failed";
  readonly code:
    | "network_error"
    | "provider_error"
    | "not_found"
    | "url_not_allowed"
    | "mime_not_allowed"
    | "too_large"
    | "checksum_mismatch"
    | "unavailable";
  readonly httpStatus: number | null;
};

export type WhatsappMediaMetadataResult =
  | {
      readonly kind: "success";
      readonly url: string;
      readonly mimeType: string | null;
      readonly sha256: string | null;
      readonly fileSize: number | null;
    }
  | WhatsappMediaFailure;

export type WhatsappMediaDownloadResult =
  | { readonly kind: "success"; readonly bytes: Uint8Array; readonly mimeType: string | null }
  | WhatsappMediaFailure;

export type WhatsappMediaUploadResult =
  | { readonly kind: "success"; readonly mediaId: string }
  | WhatsappMediaFailure
  | { readonly kind: "rejected"; readonly reason: string };

export interface WhatsappMediaAdapter {
  readonly providerCode: "fake" | "meta";
  retrieveMediaMetadata(request: { readonly mediaId: string }): Promise<WhatsappMediaMetadataResult>;
  downloadMedia(request: { readonly url: string; readonly maxBytes: number }): Promise<WhatsappMediaDownloadResult>;
  uploadMedia(request: {
    readonly phoneNumberId: string;
    readonly kind: WhatsappMediaKind;
    readonly mimeType: string;
    readonly bytes: Uint8Array;
    readonly filename: string;
  }): Promise<WhatsappMediaUploadResult>;
}

const fail = (code: WhatsappMediaFailure["code"], httpStatus: number | null = null): WhatsappMediaFailure => ({
  kind: "failed",
  code,
  httpStatus,
});

/** Read at most `maxBytes`; abort the stream the moment it would exceed. */
export async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!response.body) return new Uint8Array(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Meta reports sha256 as hex on the media endpoint and the webhook has carried
 * base64; either form is compared. An absent or unrecognised checksum does not
 * fail the download, a present one that disagrees does.
 */
export function whatsappMediaChecksumMatches(bytes: Uint8Array, expected: string | null): boolean {
  if (!expected) return true;
  const hash = createHash("sha256").update(bytes);
  const hex = hash.copy().digest("hex");
  const base64 = hash.digest("base64");
  if (/^[0-9a-f]{64}$/i.test(expected)) return expected.toLowerCase() === hex;
  if (/^[A-Za-z0-9+/]{43}=?$/.test(expected)) return expected.replace(/=$/, "") === base64.replace(/=$/, "");
  return true;
}

export function createMetaWhatsappMediaAdapter(env: WhatsappBusinessServerEnv): WhatsappMediaAdapter {
  if (env.mode !== "enabled" || !env.accessToken) {
    throw new Error("[ONEDECORE Meta Media Adapter] enabled mode with credentials required.");
  }
  const authorization = `Bearer ${env.accessToken}`;

  return {
    providerCode: "meta",

    async retrieveMediaMetadata({ mediaId }) {
      if (!/^[0-9]{1,64}$/.test(mediaId)) return fail("not_found");
      let response: Response;
      try {
        response = await fetch(buildMetaGraphUrl(env.graphApiVersion, [mediaId]), {
          headers: { Authorization: authorization },
          signal: AbortSignal.timeout(10_000),
          redirect: "error",
        });
      } catch {
        return fail("network_error");
      }
      if (response.status === 404) return fail("not_found", 404);
      if (!response.ok) return fail("provider_error", response.status);

      const raw = await readBoundedBody(response, 16_384);
      let body: Record<string, unknown> = {};
      try {
        const parsed: unknown = raw ? JSON.parse(new TextDecoder().decode(raw)) : {};
        body = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
      } catch {
        return fail("provider_error", response.status);
      }
      if (!isAllowedWhatsappMediaDownloadUrl(body.url)) return fail("url_not_allowed", response.status);
      const size = Number(body.file_size);
      return {
        kind: "success",
        url: body.url as string,
        mimeType: normalizeWhatsappMimeType(body.mime_type),
        sha256: typeof body.sha256 === "string" ? body.sha256.slice(0, 128) : null,
        fileSize: Number.isFinite(size) && size >= 0 ? size : null,
      };
    },

    async downloadMedia({ url, maxBytes }) {
      if (!isAllowedWhatsappMediaDownloadUrl(url)) return fail("url_not_allowed");
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: authorization },
          signal: AbortSignal.timeout(30_000),
          redirect: "error",
        });
      } catch {
        return fail("network_error");
      }
      if (!response.ok) return fail("provider_error", response.status);
      const bytes = await readBoundedBody(response, maxBytes);
      if (!bytes) return fail("too_large", response.status);
      return { kind: "success", bytes, mimeType: normalizeWhatsappMimeType(response.headers.get("content-type")) };
    },

    async uploadMedia({ phoneNumberId, kind, mimeType, bytes, filename }) {
      const validation = validateWhatsappOutboundMedia({ kind, mimeType, byteLength: bytes.byteLength });
      if (!validation.ok) return { kind: "rejected", reason: validation.reason };
      if (!/^[0-9]{1,64}$/.test(phoneNumberId)) return { kind: "rejected", reason: "phone_number_id_invalid" };

      const form = new FormData();
      form.set("messaging_product", "whatsapp");
      form.set("type", validation.mimeType);
      form.set("file", new Blob([bytes as BlobPart], { type: validation.mimeType }), filename);

      let response: Response;
      try {
        response = await fetch(buildMetaGraphUrl(env.graphApiVersion, [phoneNumberId, "media"]), {
          method: "POST",
          headers: { Authorization: authorization },
          body: form,
          signal: AbortSignal.timeout(60_000),
          redirect: "error",
        });
      } catch {
        return fail("network_error");
      }
      if (!response.ok) return fail("provider_error", response.status);
      const raw = await readBoundedBody(response, 4096);
      try {
        const parsed = JSON.parse(new TextDecoder().decode(raw ?? new Uint8Array())) as { id?: unknown };
        return typeof parsed.id === "string" && /^[0-9]{1,64}$/.test(parsed.id)
          ? { kind: "success", mediaId: parsed.id }
          : fail("provider_error", response.status);
      } catch {
        return fail("provider_error", response.status);
      }
    },
  };
}

/**
 * local-test: no network and no invented bytes. Inbound media cannot be
 * fetched without Meta, so this says so; upload validates exactly like the
 * real adapter and then reports the provider as unavailable.
 */
export function createFakeWhatsappMediaAdapter(): WhatsappMediaAdapter {
  return {
    providerCode: "fake",
    async retrieveMediaMetadata() {
      return fail("unavailable");
    },
    async downloadMedia({ url }) {
      return isAllowedWhatsappMediaDownloadUrl(url) ? fail("unavailable") : fail("url_not_allowed");
    },
    async uploadMedia({ kind, mimeType, bytes }) {
      const validation = validateWhatsappOutboundMedia({ kind, mimeType, byteLength: bytes.byteLength });
      return validation.ok ? fail("unavailable") : { kind: "rejected", reason: validation.reason };
    },
  };
}
