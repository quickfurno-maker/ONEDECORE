import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/service-role";
import {
  whatsappOutboundMediaKindForMime,
  whatsappOutboundMediaMaxBytes,
  type WhatsappOutboundMediaKind,
} from "../contracts/outbound-media.ts";

export const WHATSAPP_OUTBOUND_MEDIA_BUCKET = "whatsapp-outbound-media";

export function normalizeWhatsappOutboundFileName(
  fileName: string
): string | null {
  const trimmed = fileName.trim();
  if (!trimmed || trimmed.length > 240) return null;
  if (
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    return null;
  }
  return trimmed;
}

export function hashWhatsappOutboundMedia(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildWhatsappOutboundMediaObjectPath(
  conversationId: string
): string {
  return `conversations/${conversationId}/outbound/${randomUUID()}`;
}

export function validateWhatsappOutboundMedia(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}):
  | {
      readonly ok: true;
      readonly kind: WhatsappOutboundMediaKind;
      readonly fileName: string;
    }
  | { readonly ok: false; readonly message: string } {
  const fileName = normalizeWhatsappOutboundFileName(input.fileName);
  if (!fileName) {
    return { ok: false, message: "Attachment filename is invalid." };
  }

  const kind = whatsappOutboundMediaKindForMime(input.mimeType);
  if (!kind) {
    return {
      ok: false,
      message: "Use JPG, PNG, WebP, PDF or MP4 attachments.",
    };
  }

  const max = whatsappOutboundMediaMaxBytes(kind);
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, message: "Attachment is empty or invalid." };
  }
  if (input.sizeBytes > max) {
    return {
      ok: false,
      message:
        kind === "image"
          ? "Images must be 5 MiB or smaller."
          : "PDF and MP4 attachments must be 16 MiB or smaller.",
    };
  }

  return { ok: true, kind, fileName };
}

export async function uploadWhatsappOutboundMedia(input: {
  objectPath: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ readonly success: boolean; readonly message?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(WHATSAPP_OUTBOUND_MEDIA_BUCKET)
    .upload(input.objectPath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) {
    return {
      success: false,
      message: "Attachment could not be stored securely.",
    };
  }

  return { success: true };
}

export async function deleteWhatsappOutboundMediaBestEffort(
  objectPath: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.storage
      .from(WHATSAPP_OUTBOUND_MEDIA_BUCKET)
      .remove([objectPath]);
  } catch {
    // Best-effort orphan cleanup after a failed intent transaction.
  }
}

export async function downloadVerifiedWhatsappOutboundMedia(input: {
  objectPath: string;
  expectedMimeType: string;
  expectedSizeBytes: number;
  expectedSha256: string;
}): Promise<Buffer> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(WHATSAPP_OUTBOUND_MEDIA_BUCKET)
    .download(input.objectPath);

  if (error || !data) {
    throw new Error("WHATSAPP_MEDIA_OBJECT_UNAVAILABLE");
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.byteLength !== input.expectedSizeBytes) {
    throw new Error("WHATSAPP_MEDIA_SIZE_MISMATCH");
  }

  const sha256 = hashWhatsappOutboundMedia(bytes);
  if (sha256 !== input.expectedSha256) {
    throw new Error("WHATSAPP_MEDIA_CHECKSUM_MISMATCH");
  }

  if (data.type && data.type !== input.expectedMimeType) {
    throw new Error("WHATSAPP_MEDIA_MIME_MISMATCH");
  }

  return bytes;
}
