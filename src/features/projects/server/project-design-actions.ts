"use server";
import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  PROJECT_DESIGN_MAX_BYTES,
  buildDesignEvidenceObjectPath,
  deleteDesignObjectBestEffort,
  hashDesignFileBytes,
  isProjectDesignAllowedMime,
  normalizeDesignFileName,
  signDesignObject,
  uploadDesignObject,
} from "./project-design-storage";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeDesignMessage(error: { message?: string } | null, fallback: string): string {
  const message = error?.message || fallback;
  if (/permission|forbidden|42501/i.test(message)) {
    return "You are not authorized to perform this design action.";
  }
  if (/IDEMPOTENCY/i.test(message)) {
    return "This request was already submitted with different details.";
  }
  if (/INELIGIBLE_DESIGNER/i.test(message)) {
    return "The selected person is not an active designer.";
  }
  if (/PROJECT_MISSING_EVIDENCE/i.test(message)) {
    return "Required design evidence is missing.";
  }
  if (/INVALID_REASON/i.test(message)) {
    return "A valid reason is required.";
  }
  if (/PROJECT_INVALID_TRANSITION/i.test(message)) {
    return "This design action is not valid in the current state.";
  }
  if (/PROJECT_NOT_FOUND/i.test(message)) {
    return "Project not found.";
  }
  return "Design action could not be completed.";
}

async function rpcJson(
  name: string,
  args: Record<string, unknown>,
  fallback: string
): Promise<{ success: boolean; message?: string; data?: Record<string, unknown> }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name as never, args as never);
  const result = asRecord(data);
  if (error || !result?.success) {
    return { success: false, message: safeDesignMessage(error, fallback) };
  }
  return { success: true, data: result };
}

export async function setProjectLeadDesignerAction(params: {
  projectId: string;
  designerId: string;
  reason?: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string; unchanged?: boolean }> {
  const result = await rpcJson(
    "set_project_lead_designer",
    {
      p_project_id: params.projectId,
      p_designer_id: params.designerId,
      p_idempotency_key: params.idempotencyKey || `lead:${params.projectId}:${randomUUID()}`,
      p_reason: params.reason || undefined,
    },
    "Lead designer assignment failed."
  );
  return { success: result.success, message: result.message, unchanged: Boolean(result.data?.unchanged) };
}

export async function addProjectSupportingDesignerAction(params: {
  projectId: string;
  designerId: string;
  reason?: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string }> {
  const result = await rpcJson(
    "add_project_supporting_designer",
    {
      p_project_id: params.projectId,
      p_designer_id: params.designerId,
      p_idempotency_key: params.idempotencyKey || `support:${params.projectId}:${randomUUID()}`,
      p_reason: params.reason || undefined,
    },
    "Supporting designer assignment failed."
  );
  return { success: result.success, message: result.message };
}

export async function removeProjectDesignerAssignmentAction(params: {
  projectId: string;
  designerId: string;
  reason: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string }> {
  const result = await rpcJson(
    "remove_project_designer_assignment",
    {
      p_project_id: params.projectId,
      p_designer_id: params.designerId,
      p_idempotency_key: params.idempotencyKey || `remove:${params.projectId}:${randomUUID()}`,
      p_reason: params.reason,
    },
    "Designer removal failed."
  );
  return { success: result.success, message: result.message };
}

export async function transitionProjectDesignAction(params: {
  projectId: string;
  targetState: string;
  reason?: string;
  revisionReturnState?: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string }> {
  const result = await rpcJson(
    "transition_project_design",
    {
      p_project_id: params.projectId,
      p_target_state: params.targetState,
      p_idempotency_key: params.idempotencyKey || `transition:${params.projectId}:${randomUUID()}`,
      p_reason: params.reason || undefined,
      p_revision_return_state: params.revisionReturnState || undefined,
    },
    "Design transition failed."
  );
  return { success: result.success, message: result.message };
}

export async function holdProjectDesignAction(params: {
  projectId: string;
  reason: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string }> {
  const result = await rpcJson(
    "hold_project_design",
    {
      p_project_id: params.projectId,
      p_reason: params.reason,
      p_idempotency_key: params.idempotencyKey || `hold:${params.projectId}:${randomUUID()}`,
    },
    "Design hold failed."
  );
  return { success: result.success, message: result.message };
}

export async function resumeProjectDesignAction(params: {
  projectId: string;
  reason: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string }> {
  const result = await rpcJson(
    "resume_project_design",
    {
      p_project_id: params.projectId,
      p_reason: params.reason,
      p_idempotency_key: params.idempotencyKey || `resume:${params.projectId}:${randomUUID()}`,
    },
    "Design resume failed."
  );
  return { success: result.success, message: result.message };
}

export async function completeProjectDesignAction(params: {
  projectId: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string }> {
  const result = await rpcJson(
    "complete_project_design",
    {
      p_project_id: params.projectId,
      p_idempotency_key: params.idempotencyKey || `complete:${params.projectId}`,
    },
    "Design completion failed."
  );
  return { success: result.success, message: result.message };
}

export async function recordProjectClientApprovalAction(params: {
  projectId: string;
  sourceType: "uploaded_artifact" | "whatsapp_message" | "offline_note";
  sourceReference?: string;
  note?: string;
  file?: File | null;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string }> {
  let storagePath: string | undefined;
  let sha256: string | undefined;
  let size: number | undefined;
  let mime: string | undefined;
  let sourceReference = params.sourceReference?.trim() || params.note?.trim() || randomUUID();

  if (params.sourceType === "uploaded_artifact") {
    const supabase = await createClient();
    const { data: allowed, error: preflightError } = await supabase.rpc(
      "can_record_project_client_approval" as never,
      { p_project_id: params.projectId } as never
    );
    if (preflightError || allowed !== true) {
      return { success: false, message: "You are not authorized to record client approval." };
    }
    if (!params.file) {
      return { success: false, message: "An approval file is required." };
    }
    const uploaded = await prepareDesignUpload(params.file);
    if (!uploaded.ok) return { success: false, message: uploaded.message };
    storagePath = buildDesignEvidenceObjectPath(params.projectId, "client_approval");
    const stored = await uploadDesignObject({
      objectPath: storagePath,
      bytes: uploaded.bytes,
      mimeType: uploaded.mimeType,
    });
    if (!stored.success) {
      return { success: false, message: stored.message };
    }
    sha256 = uploaded.sha256;
    size = uploaded.bytes.length;
    mime = uploaded.mimeType;
    sourceReference = storagePath;
  }

  const result = await rpcJson(
    "record_project_client_approval",
    {
      p_project_id: params.projectId,
      p_idempotency_key: params.idempotencyKey || `client-approval:${params.projectId}:${randomUUID()}`,
      p_source_type: params.sourceType,
      p_source_reference: sourceReference,
      p_note: params.note || undefined,
      p_storage_object_path: storagePath,
      p_file_sha256: sha256,
      p_file_size_bytes: size,
      p_mime_type: mime,
    },
    "Client approval could not be recorded."
  );

  if (!result.success && storagePath) {
    await deleteDesignObjectBestEffort(storagePath);
  }
  return { success: result.success, message: result.message };
}

export async function approveProjectProductionReadyAction(params: {
  projectId: string;
  note: string;
  file?: File | null;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string }> {
  let storagePath: string | undefined;
  let sha256: string | undefined;
  let size: number | undefined;
  let mime: string | undefined;
  let sourceType: "uploaded_artifact" | "offline_note" = "offline_note";
  let sourceReference = params.note.trim();

  if (params.file) {
    const supabase = await createClient();
    const { data: allowed, error: preflightError } = await supabase.rpc(
      "can_approve_project_production_ready" as never,
      { p_project_id: params.projectId } as never
    );
    if (preflightError || allowed !== true) {
      return { success: false, message: "You are not authorized to approve production ready." };
    }
    const uploaded = await prepareDesignUpload(params.file);
    if (!uploaded.ok) return { success: false, message: uploaded.message };
    storagePath = buildDesignEvidenceObjectPath(params.projectId, "production_ready");
    const stored = await uploadDesignObject({
      objectPath: storagePath,
      bytes: uploaded.bytes,
      mimeType: uploaded.mimeType,
    });
    if (!stored.success) return { success: false, message: stored.message };
    sourceType = "uploaded_artifact";
    sha256 = uploaded.sha256;
    size = uploaded.bytes.length;
    mime = uploaded.mimeType;
    sourceReference = storagePath;
  }

  const result = await rpcJson(
    "approve_project_production_ready",
    {
      p_project_id: params.projectId,
      p_idempotency_key: params.idempotencyKey || `prd:${params.projectId}:${randomUUID()}`,
      p_source_type: sourceType,
      p_source_reference: sourceReference,
      p_note: params.note,
      p_storage_object_path: storagePath,
      p_file_sha256: sha256,
      p_file_size_bytes: size,
      p_mime_type: mime,
    },
    "Production ready approval failed."
  );
  if (!result.success && storagePath) {
    await deleteDesignObjectBestEffort(storagePath);
  }
  return { success: result.success, message: result.message };
}

export async function uploadProjectDesignDeliverableAction(params: {
  projectId: string;
  deliverableKey: string;
  kind: string;
  label: string;
  file: File;
  idempotencyKey?: string;
}): Promise<{ success: boolean; message?: string }> {
  const prepared = await prepareDesignUpload(params.file);
  if (!prepared.ok) return { success: false, message: prepared.message };

  const reserveKey = params.idempotencyKey || `reserve:${params.projectId}:${params.deliverableKey}:${randomUUID()}`;
  const reserved = await rpcJson(
    "reserve_project_design_deliverable_version",
    {
      p_project_id: params.projectId,
      p_deliverable_key: params.deliverableKey,
      p_kind: params.kind,
      p_label: params.label,
      p_file_name: prepared.fileName,
      p_mime_type: prepared.mimeType,
      p_file_size_bytes: prepared.bytes.length,
      p_file_sha256: prepared.sha256,
      p_idempotency_key: reserveKey,
    },
    "Deliverable reservation failed."
  );
  if (!reserved.success || !reserved.data?.object_path || !reserved.data.version_id) {
    return { success: false, message: reserved.message || "Deliverable reservation failed." };
  }

  const objectPath = String(reserved.data.object_path);
  const stored = await uploadDesignObject({
    objectPath,
    bytes: prepared.bytes,
    mimeType: prepared.mimeType,
  });
  if (!stored.success) {
    return { success: false, message: stored.message };
  }

  const finalized = await rpcJson(
    "finalize_project_design_deliverable_version",
    {
      p_version_id: reserved.data.version_id,
      p_idempotency_key: `finalize:${String(reserved.data.version_id)}`,
    },
    "Deliverable finalize failed."
  );
  return { success: finalized.success, message: finalized.message };
}

export async function getProjectDesignFileUrlAction(params: {
  projectId: string;
  versionId: string;
}): Promise<{ success: boolean; message?: string; url?: string; expiresInSeconds?: number }> {
  const supabase = await createClient();
  const { data: allowed, error: authError } = await supabase.rpc("can_view_project_design" as never, {
    p_project_id: params.projectId,
  } as never);
  if (authError || allowed !== true) {
    return { success: false, message: "You are not authorized to view this design file." };
  }

  const { data: version, error } = await supabase
    .from("project_design_deliverable_versions" as never)
    .select("id, project_id, object_path, upload_status, bucket_id")
    .eq("id" as never, params.versionId)
    .maybeSingle();

  const row = version as {
    project_id?: string;
    object_path?: string;
    upload_status?: string;
    bucket_id?: string;
  } | null;
  if (error || !row || row.project_id !== params.projectId) {
    return { success: false, message: "Design file not found." };
  }
  if (row.upload_status !== "ready" || row.bucket_id !== "project-design-documents") {
    return { success: false, message: "Design file is not ready." };
  }

  const url = await signDesignObject(String(row.object_path));
  if (!url) {
    return { success: false, message: "Design file could not be signed." };
  }
  return { success: true, url, expiresInSeconds: 900 };
}

export async function getProjectDesignEvidenceFileUrlAction(params: {
  projectId: string;
  evidenceId: string;
}): Promise<{ success: boolean; message?: string; url?: string; expiresInSeconds?: number }> {
  const supabase = await createClient();
  const { data: allowed, error: authError } = await supabase.rpc("can_view_project_design" as never, {
    p_project_id: params.projectId,
  } as never);
  if (authError || allowed !== true) {
    return { success: false, message: "You are not authorized to view this design evidence." };
  }

  const { data: evidence, error } = await supabase
    .from("project_design_evidence" as never)
    .select("id, project_id, source_type, storage_object_path")
    .eq("id" as never, params.evidenceId)
    .maybeSingle();

  const row = evidence as {
    project_id?: string;
    source_type?: string;
    storage_object_path?: string | null;
  } | null;
  if (error || !row || row.project_id !== params.projectId) {
    return { success: false, message: "Design evidence not found." };
  }
  if (row.source_type !== "uploaded_artifact" || !row.storage_object_path) {
    return { success: false, message: "This evidence is not an uploaded file." };
  }
  const expectedPrefix = `projects/${params.projectId}/evidence/`;
  if (
    row.storage_object_path.includes("..") ||
    !row.storage_object_path.startsWith(expectedPrefix)
  ) {
    return { success: false, message: "Design evidence path is invalid." };
  }

  const url = await signDesignObject(row.storage_object_path);
  if (!url) {
    return { success: false, message: "Design evidence could not be signed." };
  }
  return { success: true, url, expiresInSeconds: 900 };
}

async function prepareDesignUpload(file: File): Promise<
  | { ok: true; bytes: Buffer; sha256: string; mimeType: string; fileName: string }
  | { ok: false; message: string }
> {
  const fileName = normalizeDesignFileName(file.name);
  if (!fileName) {
    return { ok: false, message: "File name is invalid." };
  }
  if (!isProjectDesignAllowedMime(file.type)) {
    return { ok: false, message: "Only PDF and image files are accepted." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length <= 0 || bytes.length > PROJECT_DESIGN_MAX_BYTES) {
    return { ok: false, message: "File size is outside the allowed range." };
  }
  return {
    ok: true,
    bytes,
    sha256: hashDesignFileBytes(bytes),
    mimeType: file.type,
    fileName,
  };
}
