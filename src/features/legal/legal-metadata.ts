import type { Metadata } from "next";
import { absoluteUrl } from "@/config/site";
import {
  LEGAL_DRAFT_BANNER,
  LEGAL_OWNER_APPROVED_BANNER,
  LEGAL_PUBLICATION_MODE,
  getLegalRobots,
  isLegalDraftMode,
  isLegalOwnerApprovedMode,
} from "@/features/legal";

export function buildLegalPageMetadata(input: {
  readonly title: string;
  readonly description: string;
  readonly path: string;
}): Metadata {
  const robots = getLegalRobots();
  const titlePrefix = isLegalDraftMode()
    ? "Draft — "
    : isLegalOwnerApprovedMode()
      ? "Owner-approved — "
      : "";

  const description = isLegalDraftMode()
    ? `${LEGAL_DRAFT_BANNER} ${input.description}`
    : isLegalOwnerApprovedMode()
      ? `${LEGAL_OWNER_APPROVED_BANNER} ${input.description}`
      : input.description;

  return {
    title: `${titlePrefix}${input.title} | ONEDECORE`,
    description,
    robots: {
      index: robots.index,
      follow: robots.follow,
      googleBot: {
        index: robots.index,
        follow: robots.follow,
      },
    },
    /*
     * A canonical is a claim that this URL is THE address of this document.
     * A draft or owner-approved-but-not-effective page is not that, and it is
     * `noindex` anyway, so it stays without one. A published page is indexable
     * and now appears in the sitemap, so it says where it lives.
     */
    alternates: {
      canonical: robots.index ? absoluteUrl(input.path.replace(/^\//, "")) : undefined,
    },
    openGraph: {
      title: `${titlePrefix}${input.title}`.trim(),
      description: isLegalDraftMode()
        ? LEGAL_DRAFT_BANNER
        : isLegalOwnerApprovedMode()
          ? LEGAL_OWNER_APPROVED_BANNER
          : input.description,
      type: "website",
    },
    other: {
      "od-legal-publication-mode": LEGAL_PUBLICATION_MODE,
    },
  };
}
