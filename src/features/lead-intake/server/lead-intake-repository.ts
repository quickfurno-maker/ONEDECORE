import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database.generated.ts";
import type { LeadIntakeRpcResult, ValidatedLeadIntake } from "../contracts.ts";

type AdminClient = SupabaseClient<Database>;

export interface SubmitLeadIntakeRpcArgs {
  readonly validated: ValidatedLeadIntake;
  readonly requestHash: string;
  readonly networkFingerprintHash: string;
  readonly phoneFingerprintHash: string;
  readonly source: "website-planner" | "local-test";
}

export async function callSubmitLeadIntakeRpc(
  client: AdminClient,
  args: SubmitLeadIntakeRpcArgs
): Promise<LeadIntakeRpcResult> {
  const { data, error } = await client.rpc("submit_lead_intake", {
    p_idempotency_key: args.validated.idempotencyKey,
    p_request_hash: args.requestHash,
    p_network_fingerprint_hash: args.networkFingerprintHash,
    p_phone_fingerprint_hash: args.phoneFingerprintHash,
    p_planner_version: args.validated.plannerVersion,
    p_submitted_name: args.validated.name,
    p_phone_e164: args.validated.phoneE164,
    p_submitted_email: args.validated.email as string | null,
    p_service_code: args.validated.service,
    p_property_code: args.validated.property,
    p_timeline_code: args.validated.timeline,
    p_room_codes: [...args.validated.rooms],
    p_budget_comfort_code: args.validated.budgetComfort as string | null,
    p_estimate_snapshot: (args.validated.estimateSnapshot ??
      null) as Database["public"]["Functions"]["submit_lead_intake"]["Args"]["p_estimate_snapshot"],
    p_locality: args.validated.locality as string | null,
    p_message: args.validated.message as string | null,
    p_landing_path: args.validated.landingPath,
    p_attribution: args.validated.attribution,
    p_source: args.source,
    p_consent_service_enquiry: true,
    p_consent_service_phone: true,
    p_consent_service_email: args.validated.consentServiceEmail,
    p_consent_whatsapp: args.validated.consentWhatsapp,
    p_copy_service_enquiry: args.validated.copyServiceEnquiry,
    p_copy_service_communication: args.validated.copyServiceCommunication,
    p_copy_whatsapp: (args.validated.copyWhatsapp ?? null) as string | null,
    p_notice_version: args.validated.noticeVersion,
    // Null when the customer was never asked, which is the whole point:
    // the row records the answer given, not a default to fill a column.
    p_qualifier_kind: (args.validated.qualifier?.kind ?? null) as string | null,
    p_qualifier_code: (args.validated.qualifier?.code ?? null) as string | null,
  } as Database["public"]["Functions"]["submit_lead_intake"]["Args"]);

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("Empty RPC result");
  }

  const result = row as {
    outcome: LeadIntakeRpcResult["outcome"];
    submission_reference: string | null;
    retry_after_seconds: number | null;
    duplicate: boolean;
  };

  return {
    outcome: result.outcome,
    submission_reference: result.submission_reference,
    retry_after_seconds: result.retry_after_seconds,
    duplicate: Boolean(result.duplicate),
  };
}
