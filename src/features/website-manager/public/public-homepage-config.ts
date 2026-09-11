import "server-only";
import { unstable_cache, revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import {
  isBannerLinkType,
  type PublicBanner,
  type BannerLinkType,
} from "../banner-model.ts";
import {
  resolveHomepageSections,
  type ResolvedHomepageSection,
  type StoredHomepageSection,
} from "../homepage-registry.ts";

/**
 * The homepage's published configuration, read without making the page dynamic.
 *
 * THE WHOLE POINT IS THAT `/` STAYS STATIC
 *
 * Moving configuration into Supabase is worthless if it costs the homepage its
 * prerender. Two things keep that from happening, and both are load-bearing:
 *
 *   1. This client is ANONYMOUS. It reads `NEXT_PUBLIC_*` env, sets no session
 *      and — critically — never touches `cookies()` or `headers()`. A single
 *      cookie read anywhere in the render tree opts the route into dynamic
 *      rendering, and the failure is silent: the build simply reports `ƒ`
 *      instead of `○` and every visitor gets a server round trip forever.
 *
 *   2. The result is wrapped in `unstable_cache` with `revalidate: false` and a
 *      tag. It is computed once and reused until a publish expires the tag.
 *
 * This is the same shape the public Portfolio delivery already uses, for the
 * same reason.
 *
 * WHY IT NEVER THROWS
 *
 * The homepage must render if Supabase is unreachable, if the tables are empty,
 * if the RPC is renamed, or if the payload is nonsense. Every failure path
 * returns `null`, and the caller falls back to the code-defined approved
 * homepage. A database outage must cost the ability to CHANGE the front page,
 * never the ability to serve it.
 */

export const HOMEPAGE_CONFIG_TAG = "website-homepage-config";
export const HOMEPAGE_CONFIG_CACHE_KEY = ["website-manager", "homepage-config"];

export interface PublicHomepageConfig {
  readonly sections: readonly ResolvedHomepageSection[];
  readonly banners: readonly PublicBanner[];
}

interface RawConfig {
  readonly sections?: unknown;
  readonly banners?: unknown;
}

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toSections(value: unknown): StoredHomepageSection[] {
  if (!Array.isArray(value)) return [];
  const rows: StoredHomepageSection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.key !== "string") continue;
    rows.push({
      key: row.key,
      order: typeof row.order === "number" ? row.order : Number.MAX_SAFE_INTEGER,
      visible: row.visible !== false,
    });
  }
  return rows;
}

/**
 * Banner rows, filtered to what can actually be rendered.
 *
 * A row with an unrecognised `linkType` is downgraded to a non-clickable card
 * rather than dropped: the artwork is still a valid banner, and losing a
 * campaign because a link field is wrong is a worse outcome than losing the
 * link. A row whose shape is unusable is dropped.
 */
function toBanners(value: unknown): PublicBanner[] {
  if (!Array.isArray(value)) return [];
  const rows: PublicBanner[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "string") continue;

    const linkType: BannerLinkType = isBannerLinkType(row.linkType) ? row.linkType : "none";
    const linkValue = typeof row.linkValue === "string" ? row.linkValue : null;

    rows.push({
      id: row.id,
      image: typeof row.image === "string" && row.image.length > 0 ? row.image : null,
      mobileImage:
        typeof row.mobileImage === "string" && row.mobileImage.length > 0
          ? row.mobileImage
          : null,
      alt: typeof row.alt === "string" ? row.alt : null,
      linkType,
      // A link type that carries no target must not carry one here either,
      // whatever the row said.
      linkValue: linkType === "internal" || linkType === "external" ? linkValue : null,
      newTab: linkType === "external" && row.newTab === true,
      order: typeof row.order === "number" ? row.order : 0,
    });
  }
  return rows.sort((a, b) => a.order - b.order);
}

async function fetchPublishedHomepageConfig(): Promise<PublicHomepageConfig | null> {
  const supabase = createAnonClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc("get_published_homepage_config");
    if (error || !data) return null;

    const raw = data as RawConfig;
    const sections = resolveHomepageSections(toSections(raw.sections));
    const banners = toBanners(raw.banners);
    return { sections, banners };
  } catch {
    // Deliberately swallowed. The caller's fallback is the approved homepage,
    // and an exception here would replace a working page with an error page.
    return null;
  }
}

/**
 * The cached read. One entry, shared by every visitor, expired only on publish.
 */
export function getPublishedHomepageConfig(): Promise<PublicHomepageConfig | null> {
  return unstable_cache(fetchPublishedHomepageConfig, HOMEPAGE_CONFIG_CACHE_KEY, {
    tags: [HOMEPAGE_CONFIG_TAG],
    revalidate: false,
  })();
}

/** Every path a published change must refresh. */
export function homepageConfigPaths(): readonly string[] {
  return ["/"];
}

/**
 * Expire the published homepage everywhere it is held.
 *
 * Both the tag and the path: the tag drops the cached config read, and the path
 * drops the prerendered HTML that was built from it. Expiring only the tag
 * leaves the old page on disk, which is exactly the "I published and nothing
 * changed" report this feature exists to avoid.
 */
export function invalidatePublishedHomepage(): { ok: boolean; warning?: string } {
  try {
    // `{ expire: 0 }` is required in Next 16 and is what the Portfolio
    // invalidation already passes: expire the entry now rather than marking it
    // stale and serving the old homepage to the next visitor.
    revalidateTag(HOMEPAGE_CONFIG_TAG, { expire: 0 });
    for (const path of homepageConfigPaths()) {
      revalidatePath(path);
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      warning:
        error instanceof Error
          ? `Published, but the homepage cache could not be refreshed: ${error.message}`
          : "Published, but the homepage cache could not be refreshed.",
    };
  }
}
