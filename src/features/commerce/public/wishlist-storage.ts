export const WISHLIST_STORAGE_KEY = "onedecore.shop.wishlist.v1";
export const RECENT_STORAGE_KEY = "onedecore.shop.recent.v1";
export const WISHLIST_CAP = 40;
export const RECENT_CAP = 8;

export interface LocalProductSnapshot {
  readonly slug: string;
  readonly name: string;
  readonly imagePath: string | null;
}

function isSnapshot(value: unknown): value is LocalProductSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) &&
    typeof row.name === "string" &&
    (row.imagePath === null || typeof row.imagePath === "string")
  );
}

export function readLocalSnapshots(raw: string | null, cap: number): LocalProductSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSnapshot).slice(0, cap);
  } catch {
    return [];
  }
}

export function toggleWishlist(
  current: readonly LocalProductSnapshot[],
  item: LocalProductSnapshot
): LocalProductSnapshot[] {
  const exists = current.some((row) => row.slug === item.slug);
  if (exists) {
    return current.filter((row) => row.slug !== item.slug);
  }
  return [item, ...current.filter((row) => row.slug !== item.slug)].slice(0, WISHLIST_CAP);
}

export function pushRecentlyViewed(
  current: readonly LocalProductSnapshot[],
  item: LocalProductSnapshot
): LocalProductSnapshot[] {
  return [item, ...current.filter((row) => row.slug !== item.slug)].slice(0, RECENT_CAP);
}
