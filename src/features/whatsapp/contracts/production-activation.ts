export interface WhatsappProductionSenderStatus {
  readonly configured: boolean;
  readonly phoneNumberIdLast6: string | null;
  readonly wabaIdLast6: string | null;
  readonly displayPhoneNumber: string | null;
  readonly phoneStatus: string | null;
  readonly accountStatus: string | null;
  readonly configuredAt: string | null;
  readonly activePhoneCount: number;
  readonly activeAccountCount: number;
}

export interface WhatsappProductionActivationEnvironment {
  readonly graphApiVersion: string;
  readonly accessTokenConfigured: boolean;
  readonly appSecretConfigured: boolean;
  readonly verifyTokenConfigured: boolean;
  readonly wabaIdConfigured: boolean;
  readonly phoneNumberIdConfigured: boolean;
  readonly wabaIdLast6: string | null;
  readonly phoneNumberIdLast6: string | null;
  readonly webhookMode: string;
  readonly outboundMode: string;
  readonly templateMode: string;
  readonly mediaMode: string;
  readonly flowMode: string;
  readonly clickTrackingMode: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

export function parseWhatsappProductionSenderStatus(
  value: unknown
): WhatsappProductionSenderStatus {
  const row = asRecord(value);
  return {
    configured: row?.configured === true,
    phoneNumberIdLast6: str(row?.phone_number_id_last6),
    wabaIdLast6: str(row?.waba_id_last6),
    displayPhoneNumber: str(row?.display_phone_number),
    phoneStatus: str(row?.phone_status),
    accountStatus: str(row?.account_status),
    configuredAt: str(row?.configured_at),
    activePhoneCount: count(row?.active_phone_count),
    activeAccountCount: count(row?.active_account_count),
  };
}

export function maskMetaId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{1,64}$/.test(trimmed)) return null;
  return trimmed.length <= 6 ? trimmed : `…${trimmed.slice(-6)}`;
}

export function normalizeMetaDisplayPhoneNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

export function productionSenderMatchesEnvironment(
  status: WhatsappProductionSenderStatus,
  env: WhatsappProductionActivationEnvironment
): boolean {
  if (!status.configured || !env.phoneNumberIdLast6 || !env.wabaIdLast6) return false;
  return (
    status.phoneNumberIdLast6 === env.phoneNumberIdLast6 &&
    status.wabaIdLast6 === env.wabaIdLast6 &&
    status.phoneStatus === "active" &&
    status.accountStatus === "active" &&
    status.activePhoneCount === 1 &&
    status.activeAccountCount === 1
  );
}
