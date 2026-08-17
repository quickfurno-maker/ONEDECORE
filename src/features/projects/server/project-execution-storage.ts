import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/service-role";

export const PROJECT_EXECUTION_BUCKET = "project-execution-documents";
export const PROJECT_EXECUTION_SIGNED_URL_SECONDS = 900;
export const PROJECT_EXECUTION_MAX_BYTES = 20 * 1024 * 1024;
export const PROJECT_EXECUTION_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProjectExecutionAllowedMime = (typeof PROJECT_EXECUTION_ALLOWED_MIME)[number];

export function isProjectExecutionAllowedMime(value: string): value is ProjectExecutionAllowedMime {
  return (PROJECT_EXECUTION_ALLOWED_MIME as readonly string[]).includes(value);
}

export function normalizeExecutionFileName(fileName: string): string | null {
  const trimmed = fileName.trim();
  if (!trimmed || trimmed.length > 240) return null;
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) return null;
  return trimmed;
}

export function hashExecutionFileBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildExecutionEvidenceObjectPath(projectId: string, evidenceType: string): string {
  return `projects/${projectId}/execution/evidence/${evidenceType}/${randomUUID()}`;
}

export async function uploadExecutionObject(params: {
  objectPath: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(PROJECT_EXECUTION_BUCKET).upload(params.objectPath, params.bytes, {
    contentType: params.mimeType,
    upsert: false,
  });
  if (error) {
    return { success: false, message: "Execution file could not be stored." };
  }
  return { success: true };
}

export async function deleteExecutionObjectBestEffort(objectPath: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.storage.from(PROJECT_EXECUTION_BUCKET).remove([objectPath]);
  } catch {
    // Best-effort orphan cleanup only.
  }
}

export async function signExecutionObject(objectPath: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PROJECT_EXECUTION_BUCKET)
    .createSignedUrl(objectPath, PROJECT_EXECUTION_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}
