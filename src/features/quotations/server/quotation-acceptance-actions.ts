"use server";

import { createClient } from "@/lib/supabase/server";
import { hashCapabilityToken } from "./quotation-capability";

export async function getQuotationByCapabilityAction(token: string): Promise<{
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}> {
  const supabase = await createClient();
  const tokenHash = hashCapabilityToken(token);

  const { data, error } = await supabase.rpc("get_quotation_by_capability", {
    p_capability_token_hash: tokenHash,
  });

  if (error || !data) {
    return {
      success: false,
      message: "QUOTATION_NOT_FOUND_OR_FORBIDDEN: Invalid or expired quotation link.",
    };
  }

  return {
    success: true,
    data: data as unknown as Record<string, unknown>,
  };
}

export async function acceptQuotationByCapabilityAction(params: {
  token: string;
  clientName: string;
  clientEmail?: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  message?: string;
  acceptanceId?: string;
  alreadyAccepted?: boolean;
  acceptedAt?: string;
}> {
  const supabase = await createClient();
  const tokenHash = hashCapabilityToken(params.token);

  const { data, error } = await supabase.rpc("accept_quotation_by_capability", {
    p_capability_token_hash: tokenHash,
    p_accepted_by_name: params.clientName,
    p_accepted_by_email: params.clientEmail || null,
    p_idempotency_key: params.idempotencyKey || null,
  });

  if (error || !data) {
    return {
      success: false,
      message: error?.message || "Client acceptance failed.",
    };
  }

  const resultObj = data as Record<string, unknown>;
  return {
    success: true,
    acceptanceId: typeof resultObj.acceptance_id === "string" ? resultObj.acceptance_id : undefined,
    alreadyAccepted: Boolean(resultObj.already_accepted),
    acceptedAt: typeof resultObj.accepted_at === "string" ? resultObj.accepted_at : undefined,
  };
}

export async function createQuotationRevisionAction(params: {
  sourceVersionId: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  message?: string;
  newVersionId?: string;
  versionNumber?: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_quotation_revision", {
    p_source_version_id: params.sourceVersionId,
    p_idempotency_key: params.idempotencyKey || null,
  });

  if (error || !data) {
    return {
      success: false,
      message: error?.message || "Revision creation failed.",
    };
  }

  const resultObj = data as Record<string, unknown>;
  return {
    success: true,
    newVersionId: typeof resultObj.new_version_id === "string" ? resultObj.new_version_id : undefined,
    versionNumber: typeof resultObj.version_number === "number" ? resultObj.version_number : undefined,
  };
}
