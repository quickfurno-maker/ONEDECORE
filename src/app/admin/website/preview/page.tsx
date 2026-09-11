import type { Metadata } from "next";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import { InteriorsConversionPage } from "@/features/public-site/interiors/InteriorsConversionPage";
import { getWebsiteDraft } from "@/features/website-manager/server/website-queries";
import { hasWebsiteManagePermission } from "@/features/website-manager/server/website-permissions";
import { bannerHasArtwork, type PublicBanner } from "@/features/website-manager/banner-model";

/**
 * Draft preview: the real homepage, rendered from the unpublished draft.
 *
 * IT IS THE SAME COMPONENT, NOT A MOCK-UP
 *
 * `InteriorsConversionPage` is mounted here exactly as `/` mounts it, with the
 * draft config in place of the published one. A second "preview" renderer would
 * be a different page that drifts from the real one, and the whole value of a
 * preview is that what you see is what will ship.
 *
 * WHY IT LIVES UNDER /admin
 *
 * Because the admin layout already requires `admin.access` and this page then
 * requires `website.manage` on top. A public `/preview?token=` route would be a
 * second authentication system guarding unpublished marketing, and there is no
 * reason to invent one when the editor is already signed in.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Homepage draft preview | ONEDECORE",
  // Belt and braces alongside the admin gate: if this ever leaks past the
  // guard, it must not become a duplicate of the homepage in a search index.
  robots: { index: false, follow: false, nocache: true },
};

export default async function WebsiteDraftPreviewPage() {
  if (!(await hasWebsiteManagePermission())) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-red-600">Access Denied</h1>
        <p className="mt-2 text-sm text-stone-600">
          You require the website.manage permission to preview homepage drafts.
        </p>
      </div>
    );
  }

  const draft = await getWebsiteDraft();
  if (!draft) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-stone-800">Nothing to preview</h1>
        <p className="mt-2 text-sm text-stone-600">No homepage draft was found.</p>
      </div>
    );
  }

  /*
   * The draft, shaped exactly like a published config.
   *
   * Disabled banners are filtered here because the PUBLISHED reader filters
   * them in SQL — if the preview showed them, it would be showing a homepage
   * the publish would not produce, which is the one thing a preview must never
   * do. Banners with no artwork are kept: they render as the empty frame, which
   * is what the live page does too.
   */
  const banners: PublicBanner[] = draft.banners
    .filter((banner) => banner.enabled)
    .map((banner, index) => ({
      id: banner.bannerId,
      image: bannerHasArtwork(banner) ? banner.image : null,
      mobileImage: banner.mobileImage,
      alt: banner.alt,
      linkType: banner.linkType,
      linkValue: banner.linkValue,
      newTab: banner.newTab,
      order: index,
    }));

  return (
    <div className={publicSiteFontVariables}>
      <InteriorsConversionPage
        previewMode
        config={{
          sections: draft.sections.map((section) => ({
            key: section.key,
            visible: section.visible,
          })),
          banners,
        }}
      />
    </div>
  );
}
