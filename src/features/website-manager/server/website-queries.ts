import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isBannerLinkType, type BannerDraft } from "../banner-model.ts";
import {
  HOMEPAGE_SECTION_REGISTRY,
  isHomepageSectionKey,
  type HomepageSectionKey,
} from "../homepage-registry.ts";
import { requireWebsiteManage } from "./website-permissions.ts";

/**
 * Reading the working draft for the admin editor.
 *
 * Uncached and request-scoped, unlike the public reader. An editor must see
 * what they just saved, and the admin routes are dynamic anyway — the whole
 * point of the caching on the public side is that the public side has no
 * session, which this does.
 */

export interface DraftSection {
  readonly key: HomepageSectionKey;
  readonly visible: boolean;
}

export interface WebsiteDraft {
  readonly draftVersionId: string;
  readonly draftVersionNumber: number;
  readonly draftUpdatedAt: string | null;
  readonly publishedVersionNumber: number | null;
  readonly publishedAt: string | null;
  readonly publishedBy: string | null;
  readonly sections: readonly DraftSection[];
  readonly banners: readonly BannerDraft[];
  /**
   * What is live right now, for the Publish dialog to diff against.
   *
   * The dialog has to answer "what will change on the live site". Comparing the
   * draft to itself-as-loaded reported nothing whenever the editor reloaded
   * between saving and publishing, which is most of the time.
   */
  readonly publishedSections: readonly DraftSection[];
  readonly publishedBanners: readonly BannerDraft[];
}

function toSections(value: unknown): DraftSection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: DraftSection[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.key !== "string" || !isHomepageSectionKey(row.key)) continue;
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    rows.push({ key: row.key, visible: row.visible !== false });
  }
  /*
   * A section that exists in code but not in the stored draft is shown, and
   * shown as visible. That is what happens when a release adds a section: the
   * editor should find it in the list rather than discover its absence after
   * publishing a draft that silently dropped it.
   */
  for (const entry of HOMEPAGE_SECTION_REGISTRY) {
    if (!seen.has(entry.key)) rows.push({ key: entry.key, visible: true });
  }
  return rows;
}

function toBanners(value: unknown): BannerDraft[] {
  if (!Array.isArray(value)) return [];
  const rows: BannerDraft[] = [];
  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.bannerId !== "string") continue;
    rows.push({
      bannerId: row.bannerId,
      internalName: typeof row.internalName === "string" ? row.internalName : "",
      image: typeof row.image === "string" && row.image ? row.image : null,
      mobileImage:
        typeof row.mobileImage === "string" && row.mobileImage ? row.mobileImage : null,
      alt: typeof row.alt === "string" && row.alt ? row.alt : null,
      linkType: isBannerLinkType(row.linkType) ? row.linkType : "none",
      linkValue: typeof row.linkValue === "string" && row.linkValue ? row.linkValue : null,
      newTab: row.newTab === true,
      enabled: row.enabled !== false,
      order: typeof row.order === "number" ? row.order : index,
    });
  }
  return rows.sort((a, b) => a.order - b.order);
}

/** The working draft, or null when the CMS has not been seeded. */
export async function getWebsiteDraft(): Promise<WebsiteDraft | null> {
  await requireWebsiteManage();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_website_homepage_draft");
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  if (typeof row.draftVersionId !== "string") return null;

  return {
    draftVersionId: row.draftVersionId,
    draftVersionNumber:
      typeof row.draftVersionNumber === "number" ? row.draftVersionNumber : 0,
    draftUpdatedAt: typeof row.draftUpdatedAt === "string" ? row.draftUpdatedAt : null,
    publishedVersionNumber:
      typeof row.publishedVersionNumber === "number" ? row.publishedVersionNumber : null,
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : null,
    publishedBy: typeof row.publishedBy === "string" ? row.publishedBy : null,
    sections: toSections(row.sections),
    banners: toBanners(row.banners),
    publishedSections: toSections(row.publishedSections),
    publishedBanners: toBanners(row.publishedBanners),
  };
}
