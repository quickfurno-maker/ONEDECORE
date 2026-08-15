"use server";
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/service-role";
import { randomUUID } from "node:crypto";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeRpcMessage(error: { message?: string } | null, fallback: string): string {
  const message = error?.message || fallback;
  if (/permission|forbidden|42501/i.test(message)) {
    return "You are not authorized to perform this project action.";
  }
  if (/IDEMPOTENCY/i.test(message)) {
    return "This request was already submitted with different details.";
  }
  if (/INELIGIBLE_PROJECT_MANAGER/i.test(message)) {
    return "The selected person is not an active project manager.";
  }
  if (/PROJECT_NOT_FOUND/i.test(message)) {
    return "Project not found.";
  }
  if (/PROJECT_INVALID_TRANSITION/i.test(message)) {
    return "This project action is not valid in the current handover state.";
  }
  return "Project action could not be completed.";
}

export async function repairProjectMaterializationAction(params: {
  quotationVersionId: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string; projectId?: string; projectNumber?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("repair_closed_won_project_materialization", {
    p_quotation_version_id: params.quotationVersionId,
    p_idempotency_key: params.idempotencyKey || `repair:${params.quotationVersionId}`,
  });

  const result = asRecord(data);
  if (error || !result?.success) {
    return { success: false, message: safeRpcMessage(error, "Repair failed.") };
  }

  return {
    success: true,
    projectId: result.project_id ? String(result.project_id) : undefined,
    projectNumber: result.project_number ? String(result.project_number) : undefined,
  };
}

export async function assignProjectManagerAction(params: {
  projectId: string;
  projectManagerId: string;
  reason?: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string; unchanged?: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_project_manager", {
    p_project_id: params.projectId,
    p_project_manager_id: params.projectManagerId,
    p_idempotency_key: params.idempotencyKey || `assign-pm:${params.projectId}:${randomUUID()}`,
    p_reason: params.reason || undefined,
  });

  const result = asRecord(data);
  if (error || !result?.success) {
    return { success: false, message: safeRpcMessage(error, "Assignment failed.") };
  }

  return {
    success: true,
    unchanged: Boolean(result.unchanged),
  };
}

export async function acceptProjectHandoverAction(params: {
  projectId: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string; idempotentReplay?: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_project_handover", {
    p_project_id: params.projectId,
    p_idempotency_key: params.idempotencyKey || `accept-handover:${params.projectId}`,
  });

  const result = asRecord(data);
  if (error || !result?.success) {
    return { success: false, message: safeRpcMessage(error, "Handover acceptance failed.") };
  }

  return {
    success: true,
    idempotentReplay: Boolean(result.idempotent_replay),
  };
}

export async function getProjectHandoverPdfUrlAction(params: {
  projectId: string;
}): Promise<{ success: boolean; message?: string; url?: string; expiresInSeconds?: number }> {
  const supabase = await createClient();
  const { data: allowed, error: authError } = await supabase.rpc(
    "can_view_project_handover_baseline",
    { p_project_id: params.projectId }
  );

  if (authError || allowed !== true) {
    return { success: false, message: "You are not authorized to view this handover PDF." };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("accepted_quotation_version_id")
    .eq("id", params.projectId)
    .maybeSingle();

  if (projectError || !project?.accepted_quotation_version_id) {
    return { success: false, message: "Project handover baseline is unavailable." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { success: false, message: "Handover PDF is temporarily unavailable." };
  }

  const { data: pdfDoc } = await admin
    .from("quotation_pdf_documents")
    .select("object_path, status")
    .eq("quotation_version_id", project.accepted_quotation_version_id)
    .maybeSingle();

  if (!pdfDoc || pdfDoc.status !== "ready" || !pdfDoc.object_path) {
    return { success: false, message: "Accepted quotation PDF is not ready." };
  }

  const { data: signed, error: signError } = await admin.storage
    .from("quotation-documents")
    .createSignedUrl(pdfDoc.object_path, 900);

  if (signError || !signed?.signedUrl) {
    return { success: false, message: "Could not create a signed PDF link." };
  }

  return {
    success: true,
    url: signed.signedUrl,
    expiresInSeconds: 900,
  };
}
