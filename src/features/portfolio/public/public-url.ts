import {
  PUBLIC_STORAGE_BUCKET,
  PUBLIC_DERIVATIVE_FILENAMES,
  ROOM_LIBRARY_PATH_PREFIX,
} from "./constants.ts";
import { PORTFOLIO_ROOM_CODES } from "./portfolio-rooms.ts";

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
  /**
   * The owning project. Pass `null` for standalone room-library media, which
   * has no project — NOT `undefined`, which means "do not check".
   */
  expectedProjectUuid?: string | null;
  expectedMediaUuid?: string;
  /** The room a standalone object must sit under. */
  expectedRoomCode?: string;
}

const ROOM_CODE_SET: ReadonlySet<string> = new Set(PORTFOLIO_ROOM_CODES);

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

  /*
   * TWO SHAPES, TOLD APART BY THE FIRST SEGMENT.
   *
   *   project   <project_uuid>/<media_uuid>/<derivative>
   *   library   room-library/<room-code>/<media_uuid>/<derivative>
   *
   * A uuid can never be the literal "room-library", so the classification is
   * unambiguous and neither shape can be spelled to look like the other. Each
   * is then validated on its own terms rather than by a loosened rule that
   * would accept both and a few things besides.
   */
  if (segments[0] === ROOM_LIBRARY_PATH_PREFIX) {
    if (segments.length !== 4) return false;

    const [, roomCode, mediaUuid, fileName] = segments;

    if (!ROOM_CODE_SET.has(roomCode!)) return false;
    if (!CANONICAL_UUID_REGEX.test(mediaUuid!)) return false;
    if (!ALLOWED_DERIVATIVE_FILENAMES.has(fileName!)) return false;

    // A caller that named a project cannot be describing a library object.
    if (options?.expectedProjectUuid) return false;
    if (options?.expectedMediaUuid && mediaUuid !== options.expectedMediaUuid) return false;
    if (options?.expectedRoomCode && roomCode !== options.expectedRoomCode) return false;

    return true;
  }

  if (segments.length !== 3) {
    return false;
  }

  const [projectUuid, mediaUuid, fileName] = segments;

  if (!CANONICAL_UUID_REGEX.test(projectUuid!) || !CANONICAL_UUID_REGEX.test(mediaUuid!)) {
    return false;
  }

  if (!ALLOWED_DERIVATIVE_FILENAMES.has(fileName!)) {
    return false;
  }

  /*
   * `null` is an assertion, not an absence: it says "this row has no project",
   * so a path that names one is wrong. `undefined` still means "unchecked".
   */
  if (options?.expectedProjectUuid === null) {
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
