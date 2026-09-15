/**
 * WM-2 — WhatsApp media policy. Pure, safe in the browser.
 *
 * WHAT THE SEAM ALLOWS
 *
 *   inbound  — a staff member who can VIEW a conversation opens an inbound
 *              photo, voice note, video, document or sticker through a
 *              server route. The route resolves the provider media id with the
 *              server token, downloads from an allowlisted Meta CDN host only,
 *              checks MIME and size against this policy, and streams it with
 *              headers that stop the browser executing it.
 *
 *   outbound — the adapter contract uploads validated bytes to Meta and sends
 *              by media ID. Sending by `link` is not offered: a link payload
 *              makes Meta fetch an arbitrary URL on ONEDECORE's behalf. There
 *              is no staff upload surface yet (no storage/retention contract),
 *              so outbound media is reported disabled rather than half-built.
 *
 * Limits mirror the WhatsApp Cloud API supported media types.
 */

export const WHATSAPP_MEDIA_KINDS = ["image", "audio", "video", "document", "sticker"] as const;
export type WhatsappMediaKind = (typeof WHATSAPP_MEDIA_KINDS)[number];

const MB = 1024 * 1024;

export const WHATSAPP_MEDIA_POLICY: Readonly<
  Record<WhatsappMediaKind, { readonly mimeTypes: readonly string[]; readonly maxBytes: number; readonly inline: boolean }>
> = {
  image: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 5 * MB, inline: true },
  sticker: { mimeTypes: ["image/webp"], maxBytes: 500 * 1024, inline: true },
  audio: {
    mimeTypes: ["audio/aac", "audio/amr", "audio/mpeg", "audio/mp4", "audio/ogg"],
    maxBytes: 16 * MB,
    inline: true,
  },
  video: { mimeTypes: ["video/mp4", "video/3gpp"], maxBytes: 16 * MB, inline: true },
  document: {
    mimeTypes: [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxBytes: 100 * MB,
    inline: false,
  },
};

/**
 * The most a single staff view streams through the application server, below
 * Meta's own document ceiling. A larger file is refused with a clear message
 * rather than buffered.
 */
export const WHATSAPP_MEDIA_VIEW_MAX_BYTES = 25 * MB;

/** Meta's media download URLs are served from these CDN hosts only. */
export const WHATSAPP_MEDIA_DOWNLOAD_HOST_SUFFIXES = [".fbsbx.com", ".whatsapp.net", ".fbcdn.net"] as const;

export function isWhatsappMediaKind(value: unknown): value is WhatsappMediaKind {
  return typeof value === "string" && (WHATSAPP_MEDIA_KINDS as readonly string[]).includes(value);
}

/** Lower-cased MIME essence without parameters, or null. */
export function normalizeWhatsappMimeType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const essence = value.split(";")[0]!.trim().toLowerCase();
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(essence) && essence.length <= 128 ? essence : null;
}

export function isAllowedWhatsappMediaMime(kind: WhatsappMediaKind, mime: unknown): boolean {
  const essence = normalizeWhatsappMimeType(mime);
  return essence !== null && WHATSAPP_MEDIA_POLICY[kind].mimeTypes.includes(essence);
}

/**
 * SSRF guard for the download step. HTTPS, default port, no credentials, and
 * a host under a Meta media CDN suffix. Anything else — including an IP
 * literal, localhost or a look-alike such as `fbsbx.com.attacker.test` — is
 * refused before a request is made.
 */
export function isAllowedWhatsappMediaDownloadUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return WHATSAPP_MEDIA_DOWNLOAD_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

export type WhatsappOutboundMediaValidation =
  | { readonly ok: true; readonly mimeType: string }
  | { readonly ok: false; readonly reason: "kind_unsupported" | "mime_not_allowed" | "empty" | "too_large" };

export function validateWhatsappOutboundMedia(input: {
  readonly kind: unknown;
  readonly mimeType: unknown;
  readonly byteLength: number;
}): WhatsappOutboundMediaValidation {
  if (!isWhatsappMediaKind(input.kind)) return { ok: false, reason: "kind_unsupported" };
  const mime = normalizeWhatsappMimeType(input.mimeType);
  if (!mime || !WHATSAPP_MEDIA_POLICY[input.kind].mimeTypes.includes(mime)) {
    return { ok: false, reason: "mime_not_allowed" };
  }
  if (!Number.isFinite(input.byteLength) || input.byteLength <= 0) return { ok: false, reason: "empty" };
  if (input.byteLength > WHATSAPP_MEDIA_POLICY[input.kind].maxBytes) return { ok: false, reason: "too_large" };
  return { ok: true, mimeType: mime };
}

/** A download filename with nothing a header or a filesystem could misread. */
export function safeWhatsappMediaFilename(filename: unknown, kind: WhatsappMediaKind, mime: string): string {
  const extension = mime.split("/")[1]?.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const base =
    typeof filename === "string"
      ? filename
          .replace(/[^\w.\- ]+/g, "_")
          .replace(/^\.+/, "")
          .trim()
          .slice(0, 100)
      : "";
  return base.length > 0 ? base : `whatsapp-${kind}.${extension}`;
}

/**
 * Response headers for streaming a media file to staff. Documents always
 * download; nothing is ever sniffed, cached or allowed to run script.
 */
export function whatsappMediaResponseHeaders(input: {
  readonly kind: WhatsappMediaKind;
  readonly mimeType: string;
  readonly filename: string;
  readonly byteLength: number;
}): Record<string, string> {
  const disposition = WHATSAPP_MEDIA_POLICY[input.kind].inline ? "inline" : "attachment";
  return {
    "Content-Type": input.mimeType,
    "Content-Length": String(input.byteLength),
    "Content-Disposition": `${disposition}; filename="${input.filename.replace(/"/g, "")}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

/** Outbound media payload by provider media ID. There is deliberately no `link` variant. */
export function buildWhatsappOutboundMediaMessagePayload(input: {
  readonly customerE164: string;
  readonly kind: WhatsappMediaKind;
  readonly mediaId: string;
  readonly caption?: string | null;
  readonly filename?: string | null;
}): Record<string, unknown> {
  if (!/^[0-9]{1,64}$/.test(input.mediaId)) {
    throw new Error("whatsapp_media_id_invalid");
  }
  const media: Record<string, unknown> = { id: input.mediaId };
  const caption = input.caption?.trim();
  if (caption && (input.kind === "image" || input.kind === "video" || input.kind === "document")) {
    media.caption = caption.slice(0, 1024);
  }
  if (input.kind === "document" && input.filename) {
    media.filename = safeWhatsappMediaFilename(input.filename, "document", "application/octet-stream");
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.customerE164.replace(/^\+/, ""),
    type: input.kind,
    [input.kind]: media,
  };
}
