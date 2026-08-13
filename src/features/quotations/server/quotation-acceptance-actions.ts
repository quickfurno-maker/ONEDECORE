"use server";
import "server-only";

import { createClient } from "@/lib/supabase/server";

interface CapabilityRpcResult {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export async function getQuotationByCapabilityAction(token: string): Promise<{
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_quotation_by_capability", {
    p_capability_token: token,
  });

  const result = data as unknown as CapabilityRpcResult | null;

  if (error || !result || !result.success) {
    return {
      success: false,
      message: "QUOTATION_NOT_FOUND_OR_FORBIDDEN: Invalid or expired quotation link.",
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

export async function acceptQuotationByCapabilityAction(params: {
  token: string;
  clientName: string;
  clientEmail?: string;
}): Promise<{
  success: boolean;
  message?: string;
  alreadyAccepted?: boolean;
  acceptedAt?: string;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_quotation_by_capability", {
    p_capability_token: params.token,
    p_accepted_by_name: params.clientName,
    p_accepted_by_email: params.clientEmail || null,
  });

  if (error || !data) {
    return {
      success: false,
      message: error?.message || "Client acceptance failed.",
    };
  }

  const resultObj = data as Record<string, unknown>;
  return {
    success: Boolean(resultObj.success),
    message: String(resultObj.message || ""),
    alreadyAccepted: Boolean(resultObj.idempotent_replay),
    acceptedAt: resultObj.accepted_at ? String(resultObj.accepted_at) : undefined,
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
    success: Boolean(resultObj.success),
    message: String(resultObj.message || ""),
    newVersionId: resultObj.version_id ? String(resultObj.version_id) : undefined,
    versionNumber: resultObj.version_number ? Number(resultObj.version_number) : undefined,
  };
}
