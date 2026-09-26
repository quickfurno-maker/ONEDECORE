export const WHATSAPP_OUTBOUND_MEDIA_KINDS = [
  "image",
  "document",
  "video",
] as const;

export type WhatsappOutboundMediaKind =
  (typeof WHATSAPP_OUTBOUND_MEDIA_KINDS)[number];

export const WHATSAPP_OUTBOUND_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,video/mp4" as const;

export const WHATSAPP_OUTBOUND_MEDIA_CAPTION_MAX = 1024;
export const WHATSAPP_OUTBOUND_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_OUTBOUND_FILE_MAX_BYTES = 16 * 1024 * 1024;

export function whatsappOutboundMediaKindForMime(
  mimeType: string
): WhatsappOutboundMediaKind | null {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/png":
    case "image/webp":
      return "image";
    case "application/pdf":
      return "document";
    case "video/mp4":
      return "video";
    default:
      return null;
  }
}

export function whatsappOutboundMediaMaxBytes(
  kind: WhatsappOutboundMediaKind
): number {
  return kind === "image"
    ? WHATSAPP_OUTBOUND_IMAGE_MAX_BYTES
    : WHATSAPP_OUTBOUND_FILE_MAX_BYTES;
}
