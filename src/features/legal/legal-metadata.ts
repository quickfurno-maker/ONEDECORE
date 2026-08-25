import type { Metadata } from "next";
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
    alternates: {
      canonical: undefined,
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
