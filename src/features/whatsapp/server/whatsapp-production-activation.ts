import "server-only";

import { createAdminClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import {
  maskMetaId,
  normalizeMetaDisplayPhoneNumber,
  parseWhatsappProductionSenderStatus,
  type WhatsappProductionActivationEnvironment,
  type WhatsappProductionSenderStatus,
} from "../contracts/production-activation.ts";
import { resolveMetaGraphApiVersion } from "./whatsapp-business-env.ts";

type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

function readOptional(env: EnvSource, name: string): string | null {
  const value = env[name];
  if (value == null || value.trim() === "") return null;
  return value.trim();
}

function mode(env: EnvSource, name: string): string {
  return readOptional(env, name) ?? "disabled";
}

export function getWhatsappProductionActivationEnvironment(
  env: EnvSource = process.env
): WhatsappProductionActivationEnvironment {
  const wabaId = readOptional(env, "META_WHATSAPP_BUSINESS_ACCOUNT_ID");
  const phoneNumberId = readOptional(env, "META_WHATSAPP_PHONE_NUMBER_ID");
  return {
    graphApiVersion: resolveMetaGraphApiVersion(env),
    accessTokenConfigured: Boolean(readOptional(env, "META_WHATSAPP_ACCESS_TOKEN")),
    appSecretConfigured: Boolean(readOptional(env, "META_WHATSAPP_APP_SECRET")),
    verifyTokenConfigured: Boolean(readOptional(env, "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN")),
    wabaIdConfigured: Boolean(wabaId),
    phoneNumberIdConfigured: Boolean(phoneNumberId),
    wabaIdLast6: wabaId && /^\d{1,64}$/.test(wabaId) ? wabaId.slice(-6) : null,
    phoneNumberIdLast6:
      phoneNumberId && /^\d{1,64}$/.test(phoneNumberId)
        ? phoneNumberId.slice(-6)
        : null,
    webhookMode: mode(env, "ONEDECORE_WHATSAPP_WEBHOOK_MODE"),
    outboundMode: mode(env, "ONEDECORE_WHATSAPP_OUTBOUND_MODE"),
    templateMode: mode(env, "ONEDECORE_WHATSAPP_TEMPLATE_MODE"),
    mediaMode: mode(env, "ONEDECORE_WHATSAPP_MEDIA_MODE"),
    flowMode: mode(env, "ONEDECORE_WHATSAPP_FLOW_MODE"),
    clickTrackingMode: mode(env, "ONEDECORE_WHATSAPP_CLICK_TRACKING_MODE"),
  };
}

export async function getWhatsappProductionSenderStatusForCurrentUser(): Promise<WhatsappProductionSenderStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_whatsapp_production_sender_status");
  if (error) {
    return parseWhatsappProductionSenderStatus(null);
  }
  return parseWhatsappProductionSenderStatus(data);
}

type MetaPhoneRow = {
  readonly id?: unknown;
  readonly display_phone_number?: unknown;
  readonly verified_name?: unknown;
  readonly quality_rating?: unknown;
  readonly code_verification_status?: unknown;
};

type MetaPhoneListResponse = {
  readonly data?: readonly MetaPhoneRow[];
  readonly error?: {
    readonly message?: unknown;
    readonly type?: unknown;
    readonly code?: unknown;
  };
};

export type WhatsappProductionActivationResult =
  | {
      readonly ok: true;
      readonly phoneNumberIdLast6: string;
      readonly wabaIdLast6: string;
      readonly displayPhoneNumber: string;
      readonly verifiedName: string | null;
      readonly qualityRating: string | null;
      readonly codeVerificationStatus: "VERIFIED";
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
    };

export interface WhatsappProductionActivationDeps {
  readonly env?: EnvSource;
  readonly fetchImpl?: typeof fetch;
  readonly createAdmin?: typeof createAdminClient;
}

export async function activateConfiguredMetaProductionSender(
  deps: WhatsappProductionActivationDeps = {}
): Promise<WhatsappProductionActivationResult> {
  const env = deps.env ?? process.env;
  const wabaId = readOptional(env, "META_WHATSAPP_BUSINESS_ACCOUNT_ID");
  const phoneNumberId = readOptional(env, "META_WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = readOptional(env, "META_WHATSAPP_ACCESS_TOKEN");
  const graphApiVersion = resolveMetaGraphApiVersion(env);

  if (!wabaId || !/^\d{1,64}$/.test(wabaId)) {
    return {
      ok: false,
      code: "WABA_NOT_CONFIGURED",
      message: "Configure the production WhatsApp Business Account ID first.",
    };
  }
  if (!phoneNumberId || !/^\d{1,64}$/.test(phoneNumberId)) {
    return {
      ok: false,
      code: "PHONE_NUMBER_NOT_CONFIGURED",
      message: "Configure the production Meta Phone Number ID first.",
    };
  }
  if (!accessToken || accessToken.length < 16) {
    return {
      ok: false,
      code: "ACCESS_TOKEN_NOT_CONFIGURED",
      message: "Configure the Meta system-user access token first.",
    };
  }

  const endpoint =
    `https://graph.facebook.com/${graphApiVersion}/${wabaId}/phone_numbers` +
    "?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status";
  const fetchImpl = deps.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch {
    return {
      ok: false,
      code: "META_UNREACHABLE",
      message: "Meta could not be reached. No sender was changed.",
    };
  }

  let payload: MetaPhoneListResponse = {};
  try {
    payload = (await response.json()) as MetaPhoneListResponse;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    return {
      ok: false,
      code: "META_VERIFICATION_FAILED",
      message: "Meta did not verify the configured WABA and phone number. No sender was changed.",
    };
  }

  const match = (Array.isArray(payload.data) ? payload.data : []).find(
    (row) => String(row.id ?? "") === phoneNumberId
  );
  if (!match) {
    return {
      ok: false,
      code: "PHONE_NOT_IN_WABA",
      message: "The configured Meta Phone Number ID is not registered under the configured WABA.",
    };
  }

  const codeVerificationStatus =
    typeof match.code_verification_status === "string"
      ? match.code_verification_status.trim().toUpperCase()
      : "";
  if (codeVerificationStatus !== "VERIFIED") {
    return {
      ok: false,
      code: "PHONE_NOT_VERIFIED",
      message:
        "Meta has not marked this phone number as VERIFIED yet. Complete phone verification before production cutover.",
    };
  }

  const displayPhoneNumber = normalizeMetaDisplayPhoneNumber(match.display_phone_number);
  if (!displayPhoneNumber) {
    return {
      ok: false,
      code: "DISPLAY_PHONE_INVALID",
      message: "Meta returned an unusable business phone number. No sender was changed.",
    };
  }

  const admin = (deps.createAdmin ?? createAdminClient)(env);
  const { error } = await admin.rpc("configure_whatsapp_production_sender", {
    p_waba_id: wabaId,
    p_phone_number_id: phoneNumberId,
    p_display_phone_number: displayPhoneNumber,
  });
  if (error) {
    return {
      ok: false,
      code: "REGISTRY_CUTOVER_FAILED",
      message: "Meta verified the number, but the production sender registry could not be updated.",
    };
  }

  return {
    ok: true,
    phoneNumberIdLast6: maskMetaId(phoneNumberId)?.replace(/^…/, "") ?? phoneNumberId.slice(-6),
    wabaIdLast6: maskMetaId(wabaId)?.replace(/^…/, "") ?? wabaId.slice(-6),
    displayPhoneNumber,
    verifiedName:
      typeof match.verified_name === "string" && match.verified_name.trim()
        ? match.verified_name.trim().slice(0, 120)
        : null,
    qualityRating:
      typeof match.quality_rating === "string" && match.quality_rating.trim()
        ? match.quality_rating.trim().slice(0, 32)
        : null,
    codeVerificationStatus: "VERIFIED",
  };
}
