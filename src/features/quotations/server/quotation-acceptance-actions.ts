"use server";
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/service-role";
import {
  resolveTrustedQuotationVersionId,
  runPostAcceptanceProjectMaterialization,
  type ProjectMaterializationState,
} from "@/features/projects/server/project-materialization";

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
  projectMaterialization?: ProjectMaterializationState;
}> {
  const supabase = await createClient();

  let trustedVersionId: string | null = null;
  try {
    const preview = await getQuotationByCapabilityAction(params.token);
    trustedVersionId = resolveTrustedQuotationVersionId(preview.data);
  } catch {
    trustedVersionId = null;
  }

  const { data, error } = await supabase.rpc("accept_quotation_by_capability", {
    p_capability_token: params.token,
    p_client_name: params.clientName,
    p_client_email: params.clientEmail || undefined,
  });

  if (error || !data) {
    return {
      success: false,
      message: error?.message || "Client acceptance failed.",
    };
  }

  const resultObj = data as Record<string, unknown>;
  const acceptanceSuccess = Boolean(resultObj.success);

  let projectMaterialization: ProjectMaterializationState | undefined;
  if (acceptanceSuccess) {
    projectMaterialization = await runPostAcceptanceProjectMaterialization({
      quotationVersionId: trustedVersionId,
      materialize: async (quotationVersionId, idempotencyKey) => {
        const admin = createAdminClient();
        const materialized = await admin.rpc("materialize_closed_won_project_internal", {
          p_quotation_version_id: quotationVersionId,
          p_idempotency_key: idempotencyKey,
        });
        const payload = materialized.data as Record<string, unknown> | null;
        return !materialized.error && payload?.success === true;
      },
    });
  }

  return {
    success: acceptanceSuccess,
    message: String(resultObj.message || ""),
    alreadyAccepted: Boolean(resultObj.idempotent_replay),
    acceptedAt: resultObj.accepted_at ? String(resultObj.accepted_at) : undefined,
    projectMaterialization,
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
    p_idempotency_key: params.idempotencyKey || undefined,
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
