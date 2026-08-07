/**
 * Phase 6B-B1 — send-intent normalization and validation contracts.
 */

import { createHash } from "node:crypto";
import { WHATSAPP_SERVICE_PURPOSE_CODE } from "./inbox-permissions.ts";

export const WHATSAPP_SEND_BODY_MAX_LENGTH = 4096;

export type WhatsappSendRequestCanonical = {
  conversationId: string;
  purposeCode: typeof WHATSAPP_SERVICE_PURPOSE_CODE;
  bodyText: string;
  replyToMessageId: string | null;
};

export function normalizeWhatsappSendBody(bodyText: string): string {
  const normalized = bodyText.trim().replace(/\s+/g, " ");
  if (normalized.length < 1 || normalized.length > WHATSAPP_SEND_BODY_MAX_LENGTH) {
    throw new Error("validation: body_text length");
  }
  return normalized;
}

export function assertWhatsappServicePurpose(
  purposeCode: string
): asserts purposeCode is typeof WHATSAPP_SERVICE_PURPOSE_CODE {
  if (purposeCode !== WHATSAPP_SERVICE_PURPOSE_CODE) {
    throw new Error("denied_purpose: only WHATSAPP_SERVICE is allowed");
  }
}

export function rejectMarketingPurpose(purposeCode: string): void {
  if (purposeCode === "MARKETING") {
    throw new Error("denied_purpose: MARKETING is blocked on service send path");
  }
  assertWhatsappServicePurpose(purposeCode);
}

export function computeWhatsappSendRequestHash(
  request: WhatsappSendRequestCanonical
): string {
  const canonical = JSON.stringify({
    conversation_id: request.conversationId,
    purpose_code: request.purposeCode,
    body_text: request.bodyText,
    reply_to_message_id: request.replyToMessageId ?? "",
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function assertTextOnlySendPayload(bodyText: string): void {
  if (bodyText.includes("\0")) {
    throw new Error("validation: non-text payload");
  }
}
