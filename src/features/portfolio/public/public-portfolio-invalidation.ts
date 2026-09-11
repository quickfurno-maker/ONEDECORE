import "server-only";
import { revalidateTag, revalidatePath } from "next/cache";
import {
  publicPortfolioPathsFor,
  publicPortfolioTagsFor,
  publicRoomLibraryPaths,
  publicRoomLibraryTags,
} from "./public-cache-keys.ts";

export type PublicInvalidationOutcome = {
  ok: boolean;
  operationId: string;
  warning?: string;
};

/**
 * Invalidates every public surface affected by a Portfolio mutation.
 *
 * This runs *after* the database or Storage write has committed, so a failure
 * here must not surface as a failed mutation. The caller receives a redacted
 * warning and an operation id for log correlation: a stale public cache is
 * recoverable, a rolled-back publication is not.
 */
export function invalidatePublicPortfolio(slug: string): PublicInvalidationOutcome {
  const operationId = `inv_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    for (const tag of publicPortfolioTagsFor(slug)) {
      revalidateTag(tag, { expire: 0 });
    }

    for (const path of publicPortfolioPathsFor(slug)) {
      revalidatePath(path);
    }

    return { ok: true, operationId };
  } catch {
    console.error(
      `[PublicPortfolioInvalidation] Redacted operation: REVALIDATION_FAILED id=${operationId}`
    );

    return {
      ok: false,
      operationId,
      warning:
        "Changes were saved, but the public cache could not be refreshed automatically. " +
        `Retry publication or contact an administrator with operation id ${operationId}.`,
    };
  }
}

/**
 * Invalidates the public surfaces a standalone room-library mutation reaches.
 *
 * Same contract as `invalidatePublicPortfolio`: it runs after the write has
 * committed, so a failure is a warning rather than a failed mutation. A stale
 * gallery is recoverable; a publication rolled back because a cache call threw
 * is not.
 *
 * Deliberately NOT `invalidatePublicPortfolio(someSlug)`: library media has no
 * slug, and inventing one to satisfy that signature would be the same lie the
 * whole feature exists to avoid.
 */
export function invalidatePublicRoomLibrary(): PublicInvalidationOutcome {
  const operationId = `inv_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    for (const tag of publicRoomLibraryTags()) {
      revalidateTag(tag, { expire: 0 });
    }
    for (const path of publicRoomLibraryPaths()) {
      revalidatePath(path);
    }
    return { ok: true, operationId };
  } catch {
    console.error(
      `[PublicPortfolioInvalidation] Redacted operation: ROOM_LIBRARY_REVALIDATION_FAILED id=${operationId}`
    );
    return {
      ok: false,
      operationId,
      warning:
        "Changes were saved, but the public room gallery cache could not be refreshed automatically. " +
        `Retry or contact an administrator with operation id ${operationId}.`,
    };
  }
}
