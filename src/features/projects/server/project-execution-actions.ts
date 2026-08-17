"use server";
import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  PROJECT_EXECUTION_MAX_BYTES,
  buildExecutionEvidenceObjectPath,
  deleteExecutionObjectBestEffort,
  hashExecutionFileBytes,
  isProjectExecutionAllowedMime,
  normalizeExecutionFileName,
  isSignableExecutionEvidencePath,
  signExecutionObject,
} from "./project-execution-storage";
import { uploadExecutionObject } from "./project-execution-storage";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeMessage(error: { message?: string } | null, fallback: string): string {
  const message = error?.message || fallback;
  if (/permission|forbidden|42501/i.test(message)) {
    return "You are not authorized to perform this execution action.";
  }
  if (/IDEMPOTENCY/i.test(message)) {
    return "This request was already submitted with different details.";
  }
  if (/PROJECT_MISSING_EVIDENCE/i.test(message)) {
    return "Required execution evidence is missing.";
  }
  if (/INVALID_REASON/i.test(message)) {
    return "A valid reason of at least 10 characters is required.";
  }
  if (/PROJECT_INVALID_TRANSITION/i.test(message)) {
    return "That execution transition is not allowed from the current state.";
  }
  return fallback;
}

async function readUpload(formData: FormData, field = "file"): Promise<{
  sourceType: "uploaded_artifact" | "offline_note";
  note: string | null;
  bytes: Buffer | null;
  mimeType: string | null;
  fileName: string | null;
} | { error: string }> {
  const note = String(formData.get("note") ?? "").trim();
  const file = formData.get(field);
  if (file instanceof File && file.size > 0) {
    if (file.size > PROJECT_EXECUTION_MAX_BYTES) {
      return { error: "File exceeds the 20 MiB limit." };
    }
    const mimeType = file.type;
    if (!isProjectExecutionAllowedMime(mimeType)) {
      return { error: "File type is not allowed." };
    }
    if (!normalizeExecutionFileName(file.name)) {
      return { error: "File name is not allowed." };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    return { sourceType: "uploaded_artifact", note: note || null, bytes, mimeType, fileName: file.name };
  }
  if (note.length >= 8) {
    return { sourceType: "offline_note", note, bytes: null, mimeType: null, fileName: null };
  }
  return { error: "Upload a file or enter an offline note of at least 8 characters." };
}

export async function repairProjectExecutionAction(projectId: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("repair_project_execution_workflow" as never, {
    p_project_id: projectId,
    p_idempotency_key: `repair-${randomUUID()}`,
  } as never);
  if (error) return { success: false, message: safeMessage(error, "Repair failed.") };
  return { success: asRecord(data)?.success === true, message: "Execution workflow ready." };
}

export async function holdProjectExecutionAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10 || reason.length > 1000) {
    return { success: false, message: "A valid reason of 10 to 1000 characters is required." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("hold_project_execution" as never, {
    p_project_id: String(formData.get("projectId") ?? ""),
    p_reason_code: String(formData.get("reasonCode") ?? ""),
    p_reason: reason,
    p_idempotency_key: `hold-${randomUUID()}`,
  } as never);
  if (error) return { success: false, message: safeMessage(error, "Hold failed.") };
  return { success: true, message: "Execution placed on hold." };
}

export async function resumeProjectExecutionAction(projectId: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resume_project_execution" as never, {
    p_project_id: projectId,
    p_idempotency_key: `resume-${randomUUID()}`,
  } as never);
  if (error) return { success: false, message: safeMessage(error, "Resume failed.") };
  return { success: true, message: "Execution resumed." };
}

export async function cancelProjectExecutionAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_project_execution" as never, {
    p_project_id: String(formData.get("projectId") ?? ""),
    p_reason: String(formData.get("reason") ?? ""),
    p_idempotency_key: `cancel-${randomUUID()}`,
  } as never);
  if (error) return { success: false, message: safeMessage(error, "Cancellation failed.") };
  return { success: true, message: "Execution cancelled. This does not undo quotation acceptance." };
}

export async function createProjectExecutionSnagAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_project_execution_snag" as never, {
    p_project_id: String(formData.get("projectId") ?? ""),
    p_title: String(formData.get("title") ?? ""),
    p_description: String(formData.get("description") ?? ""),
    p_idempotency_key: `snag-${randomUUID()}`,
  } as never);
  if (error) return { success: false, message: safeMessage(error, "Could not create snag.") };
  return { success: true, message: "Snag recorded." };
}

export async function startProjectExecutionSnagAction(snagId: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_project_execution_snag" as never, {
    p_snag_id: snagId,
    p_idempotency_key: `snag-start-${randomUUID()}`,
  } as never);
  if (error) return { success: false, message: safeMessage(error, "Could not start snag.") };
  return { success: true, message: "Snag in progress." };
}

async function evidencedRpc(params: {
  preauthRpc: string;
  preauthArgs: Record<string, unknown>;
  mutationRpc: string;
  projectId: string;
  evidenceType: string;
  extraArgs: Record<string, unknown>;
  formData: FormData;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = await readUpload(params.formData);
  if ("error" in parsed) return { success: false, message: parsed.error };
  const supabase = await createClient();
  const { data: allowed, error: preflightError } = await supabase.rpc(
    params.preauthRpc as never,
    params.preauthArgs as never
  );
  if (preflightError || allowed !== true) {
    return { success: false, message: "You are not authorized for this execution action." };
  }

  let objectPath: string | null = null;
  let sha: string | null = null;
  let size: number | null = null;
  let mime: string | null = null;
  if (parsed.sourceType === "uploaded_artifact" && parsed.bytes && parsed.mimeType) {
    objectPath = buildExecutionEvidenceObjectPath(params.projectId, params.evidenceType);
    sha = hashExecutionFileBytes(parsed.bytes);
    size = parsed.bytes.length;
    mime = parsed.mimeType;
    const uploaded = await uploadExecutionObject({
      objectPath,
      bytes: parsed.bytes,
      mimeType: parsed.mimeType,
    });
    if (!uploaded.success) {
      return { success: false, message: uploaded.message };
    }
  }

  const mutationArgs = {
    ...params.extraArgs,
    p_source_type: parsed.sourceType,
    p_source_reference: parsed.sourceType === "uploaded_artifact" ? objectPath : `offline-${randomUUID()}`,
    p_note: parsed.note,
    p_storage_object_path: objectPath,
    p_file_sha256: sha,
    p_file_size_bytes: size,
    p_mime_type: mime,
    p_idempotency_key: `${params.evidenceType}-${randomUUID()}`,
  };
  const { error } = await supabase.rpc(params.mutationRpc as never, mutationArgs as never);
  if (error) {
    if (objectPath) await deleteExecutionObjectBestEffort(objectPath);
    return { success: false, message: safeMessage(error, "Execution mutation failed.") };
  }
  return { success: true, message: "Recorded." };
}

export async function transitionProjectExecutionAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  const projectId = String(formData.get("projectId") ?? "");
  const targetState = String(formData.get("targetState") ?? "");
  if (targetState === "snag_resolution") {
    const supabase = await createClient();
    const { data: allowed, error: preflightError } = await supabase.rpc(
      "can_transition_project_execution" as never,
      { p_project_id: projectId, p_target_state: targetState } as never
    );
    if (preflightError || allowed !== true) {
      return { success: false, message: "You are not authorized for this execution action." };
    }
    const { error } = await supabase.rpc("transition_project_execution" as never, {
      p_project_id: projectId,
      p_target_state: targetState,
      p_idempotency_key: `transition-${randomUUID()}`,
    } as never);
    if (error) return { success: false, message: safeMessage(error, "Execution mutation failed.") };
    return { success: true, message: "Recorded." };
  }
  return evidencedRpc({
    preauthRpc: "can_transition_project_execution",
    preauthArgs: { p_project_id: projectId, p_target_state: targetState },
    mutationRpc: "transition_project_execution",
    projectId,
    evidenceType: "stage_transition",
    extraArgs: { p_project_id: projectId, p_target_state: targetState },
    formData,
  });
}

export async function resolveProjectExecutionSnagAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  const snagId = String(formData.get("snagId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  return evidencedRpc({
    preauthRpc: "can_resolve_project_execution_snag",
    preauthArgs: { p_snag_id: snagId },
    mutationRpc: "resolve_project_execution_snag",
    projectId,
    evidenceType: "snag_resolution",
    extraArgs: { p_snag_id: snagId },
    formData,
  });
}

export async function recordProjectExecutionHandoverAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  const projectId = String(formData.get("projectId") ?? "");
  return evidencedRpc({
    preauthRpc: "can_record_project_execution_handover",
    preauthArgs: { p_project_id: projectId },
    mutationRpc: "record_project_execution_handover",
    projectId,
    evidenceType: "handover_acknowledgement",
    extraArgs: { p_project_id: projectId },
    formData,
  });
}

export async function completeProjectExecutionAction(formData: FormData): Promise<{ success: boolean; message?: string }> {
  const projectId = String(formData.get("projectId") ?? "");
  return evidencedRpc({
    preauthRpc: "can_complete_project_execution",
    preauthArgs: { p_project_id: projectId },
    mutationRpc: "complete_project_execution",
    projectId,
    evidenceType: "completion_acknowledgement",
    extraArgs: { p_project_id: projectId },
    formData,
  });
}

export async function getProjectExecutionEvidenceFileUrlAction(
  projectId: string,
  evidenceId: string
): Promise<{ success: boolean; url?: string; message?: string }> {
  const supabase = await createClient();
  const { data: allowed, error: viewError } = await supabase.rpc(
    "can_view_project_execution_detail" as never,
    { p_project_id: projectId } as never
  );
  if (viewError || allowed !== true) {
    return { success: false, message: "You are not authorized to open this evidence." };
  }
  const { data, error } = await supabase
    .from("project_execution_evidence" as never)
    .select("id, project_id, source_type, storage_object_path")
    .eq("id", evidenceId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !data) {
    return { success: false, message: "Evidence was not found." };
  }
  const row = asRecord(data);
  if (row?.source_type !== "uploaded_artifact") {
    return { success: false, message: "This evidence has no uploaded file." };
  }
  const path = row.storage_object_path;
  if (typeof path !== "string" || !path.trim()) {
    return { success: false, message: "This evidence has no uploaded file." };
  }
  if (!isSignableExecutionEvidencePath(projectId, path)) {
    return { success: false, message: "This evidence path is not signable." };
  }
  const url = await signExecutionObject(path);
  if (!url) return { success: false, message: "Could not create a signed URL." };
  return { success: true, url };
}
