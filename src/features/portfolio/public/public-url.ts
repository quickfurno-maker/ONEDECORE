import { PUBLIC_STORAGE_BUCKET, PUBLIC_DERIVATIVE_FILENAMES } from "./constants.ts";

/**
 * PostgreSQL renders uuid values as lowercase canonical 8-4-4-4-12 hex.
 * Anything else reaching this builder did not originate from the database.
 */
const CANONICAL_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ALLOWED_DERIVATIVE_FILENAMES: ReadonlySet<string> = new Set(
  PUBLIC_DERIVATIVE_FILENAMES
);

export interface StoragePathValidationOptions {
  expectedProjectUuid?: string;
  expectedMediaUuid?: string;
}

/**
 * Validates a stored `public_object_path` against the exact public derivative
 * contract: `<project_uuid>/<media_uuid>/<approved-derivative>.webp`.
 */
export function validatePublicStoragePath(
  publicObjectPath: string,
  options?: StoragePathValidationOptions
): boolean {
  if (typeof publicObjectPath !== "string" || publicObjectPath.length === 0) {
    return false;
  }

  // Percent-encoding is never produced by the upload pipeline, so any escape
  // sequence here is an attempt to smuggle a separator or traversal segment.
  if (publicObjectPath.includes("%")) {
    return false;
  }

  if (
    publicObjectPath.includes("..") ||
    publicObjectPath.includes("\\") ||
    publicObjectPath.includes("?") ||
    publicObjectPath.includes("#") ||
    publicObjectPath.includes(" ") ||
    publicObjectPath.includes(":") ||
    publicObjectPath.startsWith("/") ||
    publicObjectPath.endsWith("/")
  ) {
    return false;
  }

  const segments = publicObjectPath.split("/");
  if (segments.length !== 3) {
    return false;
  }

  const [projectUuid, mediaUuid, fileName] = segments;

  if (!CANONICAL_UUID_REGEX.test(projectUuid) || !CANONICAL_UUID_REGEX.test(mediaUuid)) {
    return false;
  }

  if (!ALLOWED_DERIVATIVE_FILENAMES.has(fileName)) {
    return false;
  }

  if (options?.expectedProjectUuid && projectUuid !== options.expectedProjectUuid) {
    return false;
  }

  if (options?.expectedMediaUuid && mediaUuid !== options.expectedMediaUuid) {
    return false;
  }

  return true;
}

/**
 * Builds a public Storage URL from the stored database path. Returns null when
 * the stored path fails the derivative or ownership contract, so callers must
 * treat the media row as undisplayable rather than guessing a URL.
 */
export function buildPublicStorageUrl(
  publicObjectPath: string,
  options?: StoragePathValidationOptions
): string | null {
  if (!validatePublicStoragePath(publicObjectPath, options)) {
    return null;
  }

  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321"
  ).replace(/\/+$/, "");

  return `${supabaseUrl}/storage/v1/object/public/${PUBLIC_STORAGE_BUCKET}/${publicObjectPath}`;
}
