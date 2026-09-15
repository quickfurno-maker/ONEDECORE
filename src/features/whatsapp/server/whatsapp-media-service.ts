import "server-only";

import { createClient as createSessionClient } from "@/lib/supabase/server";
import {
  isAllowedWhatsappMediaMime,
  isWhatsappMediaKind,
  normalizeWhatsappMimeType,
  safeWhatsappMediaFilename,
  WHATSAPP_MEDIA_POLICY,
  WHATSAPP_MEDIA_VIEW_MAX_BYTES,
  type WhatsappMediaKind,
} from "../contracts/media-policy.ts";
import {
  getWhatsappMediaServerEnv,
  type WhatsappBusinessServerEnv,
} from "./whatsapp-business-env.ts";
import {
  createFakeWhatsappMediaAdapter,
  createMetaWhatsappMediaAdapter,
  whatsappMediaChecksumMatches,
  type WhatsappMediaAdapter,
} from "./whatsapp-media-adapter.ts";

/**
 * WM-2 — open one inbound WhatsApp media file for the CURRENT staff member.
 *
 *   1. `authorize_whatsapp_inbound_media_view` (staff session): the actor must
 *      be able to view the conversation right now; the access is recorded; only
 *      the provider media id and declared metadata come back.
 *   2. Declared MIME must be on the policy for the message kind.
 *   3. Server token resolves the id to a CDN url; the url must be allowlisted.
 *   4. Provider MIME must match policy (and the declared type); size is capped.
 *   5. Download with a byte ceiling; checksum verified when Meta supplied one.
 *
 * Nothing is stored. A refused, missing or tombstone-hidden message all answer
 * `not_found`.
 */

type RpcClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export type WhatsappMediaViewDeps = {
  readonly getEnv?: () => WhatsappBusinessServerEnv;
  readonly createSessionClient?: () => Promise<RpcClient>;
  readonly createAdapter?: (env: WhatsappBusinessServerEnv) => WhatsappMediaAdapter;
};

export type WhatsappMediaViewResult =
  | { readonly kind: "disabled" }
  | { readonly kind: "not_found" }
  | { readonly kind: "rejected"; readonly reason: "mime_not_allowed" | "too_large" | "checksum_mismatch" | "url_not_allowed" }
  | { readonly kind: "unavailable"; readonly reason: string }
  | {
      readonly kind: "ok";
      readonly bytes: Uint8Array;
      readonly mimeType: string;
      readonly mediaKind: WhatsappMediaKind;
      readonly filename: string;
    };

function adapterFor(env: WhatsappBusinessServerEnv, factory: WhatsappMediaViewDeps["createAdapter"]): WhatsappMediaAdapter {
  if (factory) return factory(env);
  return env.providerCode === "fake" ? createFakeWhatsappMediaAdapter() : createMetaWhatsappMediaAdapter(env);
}

export async function openInboundWhatsappMediaForCurrentUser(
  messageId: string,
  deps: WhatsappMediaViewDeps = {}
): Promise<WhatsappMediaViewResult> {
  let env: WhatsappBusinessServerEnv;
  try {
    env = (deps.getEnv ?? getWhatsappMediaServerEnv)();
  } catch {
    return { kind: "unavailable", reason: "misconfigured" };
  }
  if (env.mode === "disabled") return { kind: "disabled" };
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return { kind: "not_found" };

  const session = deps.createSessionClient
    ? await deps.createSessionClient()
    : ((await createSessionClient()) as unknown as RpcClient);
  const { data, error } = await session.rpc("authorize_whatsapp_inbound_media_view", { p_message_id: messageId });
  if (error) {
    return error.code === "P0002" || error.message.includes("whatsapp_media_not_found")
      ? { kind: "not_found" }
      : { kind: "unavailable", reason: "authorization_failed" };
  }

  const grant = (data ?? {}) as {
    media_id?: unknown;
    media_kind?: unknown;
    declared_mime_type?: unknown;
    declared_sha256?: unknown;
    filename?: unknown;
  };
  if (typeof grant.media_id !== "string" || !isWhatsappMediaKind(grant.media_kind)) return { kind: "not_found" };
  const mediaKind = grant.media_kind;
  const declaredMime = normalizeWhatsappMimeType(grant.declared_mime_type);
  if (declaredMime !== null && !isAllowedWhatsappMediaMime(mediaKind, declaredMime)) {
    return { kind: "rejected", reason: "mime_not_allowed" };
  }

  const maxBytes = Math.min(WHATSAPP_MEDIA_POLICY[mediaKind].maxBytes, WHATSAPP_MEDIA_VIEW_MAX_BYTES);
  const adapter = adapterFor(env, deps.createAdapter);

  const metadata = await adapter.retrieveMediaMetadata({ mediaId: grant.media_id });
  if (metadata.kind !== "success") {
    if (metadata.code === "url_not_allowed") return { kind: "rejected", reason: "url_not_allowed" };
    return metadata.code === "not_found" ? { kind: "not_found" } : { kind: "unavailable", reason: metadata.code };
  }

  const providerMime = metadata.mimeType ?? declaredMime;
  if (!providerMime || !isAllowedWhatsappMediaMime(mediaKind, providerMime) || (declaredMime && providerMime !== declaredMime)) {
    return { kind: "rejected", reason: "mime_not_allowed" };
  }
  if (metadata.fileSize !== null && metadata.fileSize > maxBytes) {
    return { kind: "rejected", reason: "too_large" };
  }

  const download = await adapter.downloadMedia({ url: metadata.url, maxBytes });
  if (download.kind !== "success") {
    if (download.code === "too_large") return { kind: "rejected", reason: "too_large" };
    if (download.code === "url_not_allowed") return { kind: "rejected", reason: "url_not_allowed" };
    return { kind: "unavailable", reason: download.code };
  }
  if (download.mimeType && download.mimeType !== providerMime) {
    return { kind: "rejected", reason: "mime_not_allowed" };
  }
  const expectedChecksum =
    metadata.sha256 ?? (typeof grant.declared_sha256 === "string" ? grant.declared_sha256 : null);
  if (!whatsappMediaChecksumMatches(download.bytes, expectedChecksum)) {
    return { kind: "rejected", reason: "checksum_mismatch" };
  }

  return {
    kind: "ok",
    bytes: download.bytes,
    mimeType: providerMime,
    mediaKind,
    filename: safeWhatsappMediaFilename(grant.filename, mediaKind, providerMime),
  };
}
