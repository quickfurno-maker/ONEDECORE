import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/service-role";

export const PROJECT_DESIGN_BUCKET = "project-design-documents";
export const PROJECT_DESIGN_SIGNED_URL_SECONDS = 900;
export const PROJECT_DESIGN_MAX_BYTES = 20 * 1024 * 1024;
export const PROJECT_DESIGN_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProjectDesignAllowedMime = (typeof PROJECT_DESIGN_ALLOWED_MIME)[number];

export function isProjectDesignAllowedMime(value: string): value is ProjectDesignAllowedMime {
  return (PROJECT_DESIGN_ALLOWED_MIME as readonly string[]).includes(value);
}

export function normalizeDesignFileName(fileName: string): string | null {
  const trimmed = fileName.trim();
  if (!trimmed || trimmed.length > 240) return null;
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) return null;
  return trimmed;
}

export function hashDesignFileBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildDesignEvidenceObjectPath(projectId: string, evidenceType: string): string {
  return `projects/${projectId}/evidence/${evidenceType}/${randomUUID()}`;
}

export async function uploadDesignObject(params: {
  objectPath: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(PROJECT_DESIGN_BUCKET).upload(params.objectPath, params.bytes, {
    contentType: params.mimeType,
    upsert: false,
  });
  if (error) {
    return { success: false, message: "Design file could not be stored." };
  }
  return { success: true };
}

export async function deleteDesignObjectBestEffort(objectPath: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.storage.from(PROJECT_DESIGN_BUCKET).remove([objectPath]);
  } catch {
    // Best-effort orphan cleanup only.
  }
}

export async function signDesignObject(objectPath: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PROJECT_DESIGN_BUCKET)
    .createSignedUrl(objectPath, PROJECT_DESIGN_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}
