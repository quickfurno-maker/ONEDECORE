"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  validateBannerLink,
  isBannerLinkType,
  MAX_ENABLED_BANNERS,
  type BannerDraft,
  type BannerLinkType,
} from "../banner-model.ts";
import {
  HOMEPAGE_SECTION_REGISTRY,
  isHomepageSectionKey,
  getHomepageSection,
} from "../homepage-registry.ts";
import { invalidatePublishedHomepage } from "../public/public-homepage-config.ts";
import { requireWebsiteManage } from "./website-permissions.ts";
import {
  validateImageMetadata,
  createSanitisedMaster,
} from "@/features/portfolio/server/portfolio-image-pipeline";

/**
 * Server actions for the Website Manager.
 *
 * EVERY ACTION CHECKS, AND SO DOES THE DATABASE
 *
 * `requireWebsiteManage` runs first so an unauthorised caller gets a clean
 * refusal instead of a Postgres error, and then the RPC underneath checks
 * again through `private.website_require_manager`. The second check is the one
 * that counts: a server action is an HTTP endpoint, and the only place that can
 * be sure who is calling is the database.
 *
 * VALIDATION IS DUPLICATED ON PURPOSE
 *
 * Link rules exist in `banner-model.ts` (for the form), here (for the action)
 * and as a check constraint (for the data). They are not three implementations
 * of one rule — they are one rule enforced at three different blast radii. The
 * constraint is the only one a script cannot route around.
 */

export interface WebsiteActionResult {
  readonly success: boolean;
  readonly message?: string;
  readonly error?: string;
  readonly warning?: string;
}

export interface SaveDraftInput {
  readonly expectedVersionId: string | null;
  readonly sections: ReadonlyArray<{ key: string; visible: boolean }>;
  readonly banners: readonly BannerDraft[];
}

/** Map a Postgres error onto something an editor can act on. */
function explain(error: { message?: string; code?: string } | null): string {
  const raw = error?.message ?? "";
  if (raw.includes("WEBSITE_FORBIDDEN") || raw.includes("WEBSITE_UNAUTHENTICATED")) {
    return "You do not have permission to manage website content.";
  }
  if (raw.includes("WEBSITE_STALE_DRAFT")) {
    return "Someone else changed this draft while you were editing. Reload the page to see their version before saving.";
  }
  if (raw.includes("WEBSITE_HERO_MUST_BE_FIRST")) {
    return "The hero must stay at the top of the homepage.";
  }
  if (raw.includes("WEBSITE_HERO_MUST_BE_VISIBLE") || raw.includes("WEBSITE_HERO_REQUIRED")) {
    return "The hero cannot be hidden.";
  }
  if (raw.includes("WEBSITE_TOO_MANY_BANNERS")) {
    return `You can have at most ${MAX_ENABLED_BANNERS} enabled banners.`;
  }
  if (raw.includes("chk_website_banner_link_value")) {
    return "One of the banner links is not allowed. Internal links start with a single /, external links must be https.";
  }
  if (raw.includes("chk_website_banner_alt_required")) {
    return "A banner with an image needs alt text.";
  }
  if (raw.includes("WEBSITE_NO_DRAFT")) {
    return "There is no working draft. Publish once to create one.";
  }
  return raw || "Something went wrong.";
}

/**
 * Normalise and validate the whole draft before it reaches the database.
 *
 * Returns the payload to send, or the first problem worth showing. Sections are
 * rebuilt from the REGISTRY rather than trusted from the client: an unknown key
 * cannot be smuggled in, and the pins are re-applied here so a tampered request
 * cannot move the hero.
 */
/*
 * The RPC parameters are `jsonb`, and the generated `Json` type demands an
 * index signature. These two carry one so the payload can be passed as-is
 * rather than cast through `unknown` — a cast here would switch off exactly the
 * checking that keeps the shape in step with the SQL.
 */
interface SectionPayload {
  readonly key: string;
  readonly order: number;
  readonly visible: boolean;
  readonly [field: string]: string | number | boolean;
}

interface BannerPayload {
  readonly [field: string]: string | number | boolean | null;
  readonly bannerId: string;
  readonly internalName: string;
  readonly image: string | null;
  readonly mobileImage: string | null;
  readonly alt: string | null;
  readonly linkType: BannerLinkType;
  readonly linkValue: string | null;
  readonly newTab: boolean;
  readonly enabled: boolean;
  readonly order: number;
}

function buildPayload(input: SaveDraftInput):
  | { ok: true; sections: SectionPayload[]; banners: BannerPayload[] }
  | { ok: false; error: string } {
  const requested = new Map<string, boolean>();
  for (const section of input.sections) {
    if (typeof section?.key !== "string" || !isHomepageSectionKey(section.key)) continue;
    requested.set(section.key, section.visible !== false);
  }

  const ordered: Array<{ key: string; visible: boolean }> = [];
  const seen = new Set<string>();
  for (const section of input.sections) {
    if (typeof section?.key !== "string" || !isHomepageSectionKey(section.key)) continue;
    if (seen.has(section.key)) continue;
    seen.add(section.key);
    ordered.push({ key: section.key, visible: requested.get(section.key) !== false });
  }
  // Anything the client omitted keeps its registry position, visible. A section
  // must never disappear from the homepage because a request was truncated.
  for (const entry of HOMEPAGE_SECTION_REGISTRY) {
    if (!seen.has(entry.key)) ordered.push({ key: entry.key, visible: true });
  }

  const hero = ordered.findIndex((s) => s.key === "hero");
  if (hero === -1) return { ok: false, error: "The hero section is missing." };
  const heroRow = ordered.splice(hero, 1)[0]!;
  const closeIndex = ordered.findIndex((s) => s.key === "consultation");
  const closeRow = closeIndex === -1 ? null : ordered.splice(closeIndex, 1)[0]!;

  const finalSections = [
    { key: heroRow.key, visible: true },
    ...ordered.map((s) => ({
      key: s.key,
      visible: getHomepageSection(s.key as never).canHide ? s.visible : true,
    })),
    ...(closeRow ? [{ key: closeRow.key, visible: true }] : []),
  ].map((s, index) => ({ key: s.key, order: index, visible: s.visible }));

  const banners: BannerPayload[] = [];
  let enabled = 0;
  const usedIds = new Set<string>();

  for (const [index, banner] of input.banners.entries()) {
    const name = (banner.internalName ?? "").trim();
    if (name.length === 0) {
      return { ok: false, error: `Banner ${index + 1} needs an internal name.` };
    }
    if (name.length > 80) {
      return { ok: false, error: `"${name.slice(0, 30)}…" is too long for an internal name.` };
    }

    const linkType: BannerLinkType = isBannerLinkType(banner.linkType)
      ? banner.linkType
      : "none";
    const link = validateBannerLink(linkType, banner.linkValue);
    if (!link.valid) {
      return { ok: false, error: `${name}: ${link.error}` };
    }

    const image = (banner.image ?? "").trim() || null;
    const mobile = (banner.mobileImage ?? "").trim() || null;
    const alt = (banner.alt ?? "").trim() || null;

    if (image && !alt) {
      return { ok: false, error: `${name} has an image, so it needs alt text.` };
    }
    if (mobile && !image) {
      return {
        ok: false,
        error: `${name} has a mobile image but no main image. Add the main image first.`,
      };
    }

    const bannerId =
      typeof banner.bannerId === "string" && banner.bannerId.length > 0
        ? banner.bannerId
        : randomUUID();
    if (usedIds.has(bannerId)) {
      return { ok: false, error: "Two banners share an id. Reload and try again." };
    }
    usedIds.add(bannerId);

    if (banner.enabled !== false) enabled += 1;

    banners.push({
      bannerId,
      internalName: name,
      image,
      mobileImage: mobile,
      alt,
      linkType,
      linkValue: link.value ?? null,
      // Only an external link may open a tab, whatever the toggle said.
      newTab: linkType === "external" && banner.newTab === true,
      enabled: banner.enabled !== false,
      order: index,
    });
  }

  if (enabled > MAX_ENABLED_BANNERS) {
    return {
      ok: false,
      error: `You can have at most ${MAX_ENABLED_BANNERS} enabled banners. Disable some first.`,
    };
  }

  return { ok: true, sections: finalSections, banners };
}

export async function saveWebsiteDraft(input: SaveDraftInput): Promise<WebsiteActionResult> {
  try {
    await requireWebsiteManage();
  } catch {
    return { success: false, error: "You do not have permission to manage website content." };
  }

  const payload = buildPayload(input);
  if (!payload.ok) return { success: false, error: payload.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_website_homepage_draft", {
    p_expected_version_id: input.expectedVersionId ?? undefined,
    p_sections: payload.sections,
    p_banners: payload.banners,
  });

  if (error) return { success: false, error: explain(error) };

  // The admin editor only. Publishing is what touches the public homepage, and
  // saving a draft deliberately does not.
  revalidatePath("/admin/website");
  revalidatePath("/admin/website/preview");
  return { success: true, message: "Draft saved." };
}

export async function publishWebsiteDraft(
  expectedDraftId: string | null
): Promise<WebsiteActionResult> {
  try {
    await requireWebsiteManage();
  } catch {
    return { success: false, error: "You do not have permission to publish website content." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_website_homepage", {
    p_expected_draft_id: expectedDraftId ?? undefined,
  });

  if (error) {
    // Nothing is invalidated on failure. Expiring the homepage cache after a
    // refused publish would serve a fresh render of the SAME content and make
    // the failure look like a success that did not take.
    return { success: false, error: explain(error) };
  }

  revalidatePath("/admin/website");
  revalidatePath("/admin/website/preview");

  const invalidation = invalidatePublishedHomepage();
  return {
    success: true,
    message: "Published. The homepage is live.",
    warning: invalidation.ok ? undefined : invalidation.warning,
  };
}

export interface UploadResult {
  readonly success: boolean;
  readonly path?: string;
  readonly width?: number;
  readonly height?: number;
  readonly error?: string;
}

/**
 * Upload one banner image.
 *
 * THE BYTES DECIDE WHAT THIS FILE IS, NOT ITS NAME
 *
 * `validateImageMetadata` is the Portfolio pipeline, reused rather than
 * reimplemented: it parses the actual header with sharp, refuses a declared
 * MIME that disagrees with the content, refuses animated and multi-page images,
 * and bounds both dimensions and total pixels so a decompression bomb cannot be
 * handed to the encoder. `createSanitisedMaster` then re-encodes through an
 * explicit encoder, which strips EXIF and guarantees the stored bytes are an
 * image this server produced rather than one an uploader supplied.
 *
 * THE PATH IS SERVER-CHOSEN
 *
 * `{bannerId}/{uuid}.{ext}` — never the uploaded filename. A client-supplied
 * name is how `../` and overwrite-someone-else's-object happen; a uuid also
 * makes every upload collision-free and cache-bustable.
 *
 * The upload goes through the request-scoped Supabase client, so the storage
 * policy re-checks `website.manage`. No service-role key is used here and none
 * is reachable from the browser.
 */
export async function uploadBannerImage(formData: FormData): Promise<UploadResult> {
  try {
    await requireWebsiteManage();
  } catch {
    return { success: false, error: "You do not have permission to upload banner images." };
  }

  const file = formData.get("file");
  const bannerId = formData.get("bannerId");

  if (!(file instanceof File)) {
    return { success: false, error: "No file was received." };
  }
  if (typeof bannerId !== "string" || !/^[0-9a-f-]{36}$/i.test(bannerId)) {
    return { success: false, error: "That banner could not be identified." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const validation = await validateImageMetadata(bytes, file.type || undefined);
  if (!validation.valid) {
    return { success: false, error: validation.error ?? "That file is not a usable image." };
  }

  const sanitised = await createSanitisedMaster(bytes, validation.format!);
  const path = `${bannerId}/${randomUUID()}.${validation.extension}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from("website-banners")
    .upload(path, sanitised, {
      contentType: validation.mimeType,
      // Never overwrite. Every upload is a new object, so a replace leaves the
      // old file addressable by any version still referencing it.
      upsert: false,
      cacheControl: "31536000",
    });

  if (error) {
    return { success: false, error: `Upload failed: ${error.message}` };
  }

  return {
    success: true,
    path,
    width: validation.width,
    height: validation.height,
  };
}
