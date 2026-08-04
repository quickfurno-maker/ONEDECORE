import "server-only";

import { createHash } from "node:crypto";

export const META_WEBHOOK_OBJECT = "whatsapp_business_account";

export type NormalizedMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "interactive"
  | "button"
  | "reaction"
  | "unknown";

export interface NormalizedInboundMessage {
  readonly kind: "inbound_message";
  readonly eventKey: string;
  readonly eventHash: string;
  readonly wabaId: string;
  readonly phoneNumberId: string;
  readonly displayPhoneNumber: string | null;
  readonly providerMessageId: string;
  readonly customerE164: string;
  readonly displayNameSnapshot: string | null;
  readonly providerMessageType: string;
  readonly normalizedMessageType: NormalizedMessageType;
  readonly bodyText: string | null;
  readonly content: Record<string, unknown>;
  readonly contextProviderMessageId: string | null;
  readonly providerTimestamp: string;
}

export interface NormalizedMessageStatus {
  readonly kind: "message_status";
  readonly eventKey: string;
  readonly eventHash: string;
  readonly wabaId: string;
  readonly phoneNumberId: string;
  readonly displayPhoneNumber: string | null;
  readonly providerMessageId: string;
  readonly status: string;
  readonly providerTimestamp: string;
  readonly details: Record<string, unknown>;
}

export type NormalizedWebhookEvent =
  | NormalizedInboundMessage
  | NormalizedMessageStatus;

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export function normalizeWaIdToE164(waId: string): string | null {
  const digits = waId.replace(/\D/g, "");
  if (!digits) return null;
  const candidate = `+${digits}`;
  return E164_PATTERN.test(candidate) ? candidate : null;
}

export function normalizeDisplayPhoneToE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (E164_PATTERN.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const candidate = `+${digits}`;
  return E164_PATTERN.test(candidate) ? candidate : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function canonicalHash(payload: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function mapMessageType(providerType: string): NormalizedMessageType {
  const known: Record<string, NormalizedMessageType> = {
    text: "text",
    image: "image",
    audio: "audio",
    video: "video",
    document: "document",
    sticker: "sticker",
    location: "location",
    contacts: "contacts",
    interactive: "interactive",
    button: "button",
    reaction: "reaction",
  };
  return known[providerType] ?? "unknown";
}

function extractBodyText(message: Record<string, unknown>): string | null {
  const providerType = asString(message.type) ?? "unknown";
  if (providerType === "text") {
    const text = message.text;
    if (isRecord(text)) {
      return asString(text.body);
    }
  }
  return null;
}

function extractContent(message: Record<string, unknown>): Record<string, unknown> {
  const providerType = asString(message.type) ?? "unknown";
  const slice = message[providerType];
  if (isRecord(slice)) {
    return slice;
  }
  return {};
}

function unixSecondsToIso(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  return null;
}

function buildMessageEventKey(
  phoneNumberId: string,
  providerMessageId: string
): string {
  return `msg:${phoneNumberId}:${providerMessageId}`;
}

function buildStatusEventKey(
  phoneNumberId: string,
  providerMessageId: string,
  status: string,
  providerTimestamp: string
): string {
  return `status:${phoneNumberId}:${providerMessageId}:${status}:${providerTimestamp}`;
}

function normalizeInboundMessage(
  wabaId: string,
  value: Record<string, unknown>,
  message: Record<string, unknown>,
  contacts: unknown
): NormalizedInboundMessage | null {
  const metadata = value.metadata;
  if (!isRecord(metadata)) return null;

  const phoneNumberId = asString(metadata.phone_number_id);
  if (!phoneNumberId || !/^\d+$/.test(phoneNumberId)) return null;

  const providerMessageId = asString(message.id);
  if (!providerMessageId) return null;

  const from = asString(message.from);
  if (!from) return null;
  const customerE164 = normalizeWaIdToE164(from);
  if (!customerE164) return null;

  const providerTimestamp = unixSecondsToIso(message.timestamp);
  if (!providerTimestamp) return null;

  const providerMessageType = asString(message.type) ?? "unknown";
  const normalizedMessageType = mapMessageType(providerMessageType);
  const bodyText = extractBodyText(message);
  const content = extractContent(message);

  let displayNameSnapshot: string | null = null;
  if (Array.isArray(contacts)) {
    for (const contact of contacts) {
      if (!isRecord(contact)) continue;
      if (asString(contact.wa_id) === from) {
        const profile = contact.profile;
        if (isRecord(profile)) {
          displayNameSnapshot = asString(profile.name);
        }
        break;
      }
    }
  }

  const context = message.context;
  const contextProviderMessageId =
    isRecord(context) ? asString(context.id) : null;

  const displayPhoneNumber = asString(metadata.display_phone_number);

  const canonical = {
    kind: "inbound_message" as const,
    wabaId,
    phoneNumberId,
    providerMessageId,
    customerE164,
    providerMessageType,
    normalizedMessageType,
    bodyText,
    content,
    contextProviderMessageId,
    providerTimestamp,
  };

  return {
    kind: "inbound_message",
    eventKey: buildMessageEventKey(phoneNumberId, providerMessageId),
    eventHash: canonicalHash(canonical),
    wabaId,
    phoneNumberId,
    displayPhoneNumber,
    providerMessageId,
    customerE164,
    displayNameSnapshot:
      displayNameSnapshot && displayNameSnapshot.length <= 120
        ? displayNameSnapshot
        : null,
    providerMessageType,
    normalizedMessageType,
    bodyText: bodyText && bodyText.length <= 4096 ? bodyText : bodyText?.slice(0, 4096) ?? null,
    content,
    contextProviderMessageId,
    providerTimestamp,
  };
}

function normalizeMessageStatus(
  wabaId: string,
  value: Record<string, unknown>,
  status: Record<string, unknown>
): NormalizedMessageStatus | null {
  const metadata = value.metadata;
  if (!isRecord(metadata)) return null;

  const phoneNumberId = asString(metadata.phone_number_id);
  if (!phoneNumberId || !/^\d+$/.test(phoneNumberId)) return null;

  const providerMessageId = asString(status.id);
  const statusValue = asString(status.status);
  if (!providerMessageId || !statusValue) return null;

  const providerTimestamp = unixSecondsToIso(status.timestamp);
  if (!providerTimestamp) return null;

  const displayPhoneNumber = asString(metadata.display_phone_number);
  const details: Record<string, unknown> = {};
  for (const key of ["recipient_id", "conversation", "pricing", "errors"] as const) {
    if (key in status) {
      details[key] = status[key];
    }
  }

  const canonical = {
    kind: "message_status" as const,
    wabaId,
    phoneNumberId,
    providerMessageId,
    status: statusValue,
    providerTimestamp,
    details,
  };

  return {
    kind: "message_status",
    eventKey: buildStatusEventKey(
      phoneNumberId,
      providerMessageId,
      statusValue,
      providerTimestamp
    ),
    eventHash: canonicalHash(canonical),
    wabaId,
    phoneNumberId,
    displayPhoneNumber,
    providerMessageId,
    status: statusValue,
    providerTimestamp,
    details,
  };
}

export function normalizeMetaWebhookPayload(
  payload: unknown
): { readonly events: NormalizedWebhookEvent[]; readonly ignored: boolean } {
  if (!isRecord(payload)) {
    return { events: [], ignored: false };
  }

  if (asString(payload.object) !== META_WEBHOOK_OBJECT) {
    return { events: [], ignored: true };
  }

  const events: NormalizedWebhookEvent[] = [];
  const entries = payload.entry;
  if (!Array.isArray(entries)) {
    return { events: [], ignored: false };
  }

  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const wabaId = asString(entry.id);
    if (!wabaId || !/^\d+$/.test(wabaId)) continue;

    const changes = entry.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      if (!isRecord(change)) continue;
      const value = change.value;
      if (!isRecord(value)) continue;

      const messages = value.messages;
      if (Array.isArray(messages)) {
        const contacts = value.contacts;
        for (const message of messages) {
          if (!isRecord(message)) continue;
          const normalized = normalizeInboundMessage(
            wabaId,
            value,
            message,
            contacts
          );
          if (normalized) events.push(normalized);
        }
      }

      const statuses = value.statuses;
      if (Array.isArray(statuses)) {
        for (const status of statuses) {
          if (!isRecord(status)) continue;
          const normalized = normalizeMessageStatus(wabaId, value, status);
          if (normalized) events.push(normalized);
        }
      }
    }
  }

  return { events, ignored: false };
}

export function resolveBusinessRecipientE164(
  displayPhoneNumber: string | null,
  phoneNumberId: string
): string | null {
  if (displayPhoneNumber) {
    const normalized = normalizeDisplayPhoneToE164(displayPhoneNumber);
    if (normalized) return normalized;
  }
  // Fallback: cannot fabricate valid E.164 from phone_number_id alone.
  void phoneNumberId;
  return null;
}
