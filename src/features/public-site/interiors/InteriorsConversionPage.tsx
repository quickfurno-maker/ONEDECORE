import { Fragment, type ReactElement } from "react";
import {
  resolveHomepageSections,
  type HomepageSectionKey,
} from "@/features/website-manager/homepage-registry";
import type { PublicHomepageConfig } from "@/features/website-manager/public/public-homepage-config";
import { HomeBudgetEstimator } from "@/features/public-site/home-r4/HomeBudgetEstimator";
import { HomeFactory } from "@/features/public-site/home-r4/HomeFactory";
import { HomeFaq } from "@/features/public-site/home-r4/HomeFaq";
import { HomeHero } from "@/features/public-site/home-r4/HomeHero";
import { HomeMaterials } from "@/features/public-site/home-r4/HomeMaterials";
import { HomePlan } from "@/features/public-site/home-r4/HomePlan";
import { HomeProcess } from "@/features/public-site/home-r4/HomeProcess";
import { HomeReviews } from "@/features/public-site/home-r4/HomeReviews";
import { HomeServicesRooms } from "@/features/public-site/home-r4/HomeServicesRooms";
import { HomeShell } from "@/features/public-site/home-r4/HomeShell";
import { HomeWhy } from "@/features/public-site/home-r4/HomeWhy";
import { LeadConsultationHost } from "@/features/lead-intake/public/LeadConsultationHost";
import { DiscoveryWhatsAppFab } from "@/features/public-site/discovery/DiscoveryWhatsAppFab";
import "@/features/public-site/discovery/discovery.css";
import { InteriorsPromoCarousel } from "./InteriorsPromoCarousel";
import {
  InteriorsKitchenFeature,
  InteriorsPortfolioBridge,
  InteriorsRenovation,
  InteriorsServiceAreas,
  InteriorsWardrobes,
} from "./InteriorsServiceBlocks";
import "./interiors.css";

/*
 * The hero opens the page; the promo rail follows it.
 *
 * The rail was briefly first, and putting it there cost the page its
 * introduction: a visitor arriving at onedecore.in met six unexplained frames
 * before anything said what the company does. Promotions are worth reading
 * once you know whose promotions they are — so the hero makes the argument,
 * the rail carries whatever is running this month, and the established
 * interiors journey continues underneath exactly as it did.
 *
 * `trust` is absent and stays absent. The page was showing two numeric proof
 * blocks within one screen of each other — the hero's credibility row, then
 * `DiscoveryProofStrip` immediately below it. Two counters arguing the same
 * point do not double the proof; they make a visitor wonder which is the real
 * number. `DiscoveryProofStrip` itself is untouched and still in the
 * repository.
 *
 * This array is rendered into `data-od-interiors-order` and asserted against
 * the mounted components, so it cannot drift from the DOM silently.
 */
export const INTERIORS_SECTION_ORDER = [
  "header",
  "hero",
  "promo-carousel",
  "complete-interiors",
  "modular-kitchen",
  "wardrobes",
  "renovation",
  "why",
  "factory",
  "estimator",
  "portfolio",
  "materials",
  "process",
  "service-areas",
  "testimonials",
  "faq",
  "consultation",
] as const;

/**
 * section key -> the component that renders it.
 *
 * This map is the reason a database row can reorder the homepage without being
 * able to change what the homepage IS. The stored config carries keys; the keys
 * are looked up here; anything not in this map never renders. There is no path
 * from a table row to an arbitrary component.
 *
 * It is checked against the registry by test, so adding a section to one and
 * forgetting the other fails in CI rather than as a blank strip on the page.
 */
const SECTION_COMPONENTS: Record<HomepageSectionKey, () => ReactElement> = {
  hero: () => <HomeHero />,
  "promo-carousel": () => <InteriorsPromoCarousel />,
  "complete-interiors": () => <HomeServicesRooms />,
  "modular-kitchen": () => <InteriorsKitchenFeature />,
  wardrobes: () => <InteriorsWardrobes />,
  renovation: () => <InteriorsRenovation />,
  why: () => <HomeWhy />,
  factory: () => <HomeFactory />,
  estimator: () => <HomeBudgetEstimator />,
  portfolio: () => <InteriorsPortfolioBridge />,
  materials: () => <HomeMaterials />,
  process: () => <HomeProcess />,
  "service-areas": () => <InteriorsServiceAreas />,
  testimonials: () => <HomeReviews />,
  faq: () => <HomeFaq />,
  consultation: () => <HomePlan />,
};

export interface InteriorsConversionPageProps {
  /**
   * The published (or, in preview, the draft) configuration.
   *
   * Absent means "render the approved homepage from code". That is not a
   * degraded mode to apologise for — it is the fallback that makes a Supabase
   * outage cost the ability to CHANGE the page rather than the ability to serve
   * it, and it is what every render did before the CMS existed.
   */
  readonly config?: PublicHomepageConfig | null;
  /** Draft preview only. Renders a noindex banner and never caches. */
  readonly previewMode?: boolean;
}

export function InteriorsConversionPage({
  config = null,
  previewMode = false,
}: InteriorsConversionPageProps = {}) {
  const sections = resolveHomepageSections(
    config?.sections?.map((section, index) => ({
      key: section.key,
      order: index,
      visible: section.visible,
    })) ?? null
  );

  const banners = config?.banners ?? null;

  return (
    <LeadConsultationHost>
      <HomeShell unifiedNav>
        <div data-od-interiors-order={sections.map((s) => s.key).join("|")} hidden />
        {previewMode ? (
          <div className="od-wm-preview-bar" role="status">
            <strong>Draft preview</strong>
            <span>This is not the live homepage. Nothing here is published yet.</span>
          </div>
        ) : null}
        {/*
          Sections render in the order the config gives, and a hidden one is
          ABSENT rather than `display: none` — an invisible section still costs
          its data, its images and its markup, and "hidden" in this tool means
          the visitor should not receive it at all.

          The promo rail is the one section that also takes data, so it is
          handed the published banners; every other section is self-contained
          code, which is exactly the boundary this CMS draws.
        */}
        {sections.map((section) =>
          section.visible ? (
            <Fragment key={section.key}>
              {section.key === "promo-carousel" ? (
                <InteriorsPromoCarousel banners={banners} />
              ) : (
                SECTION_COMPONENTS[section.key]()
              )}
            </Fragment>
          ) : null
        )}
        {/*
          THE SAME FAB THE HOMEPAGE USES — one component, one instance.

          Not a copy styled to match: a second implementation would be two
          places to keep the validated href, the reduced-motion handling and the
          tap haptic in step, and they would drift. This page already imports
          `discovery.css`, so the existing styles apply as they are.

          It renders inside the shell so it sits above `.pm-sticky` in the same
          stacking context the sticky bar lives in. It is global chrome, not a
          managed section: "hide the WhatsApp button" is not an editorial choice
          the Website Manager offers.
        */}
        <DiscoveryWhatsAppFab />
      </HomeShell>
    </LeadConsultationHost>
  );
}
