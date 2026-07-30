import type { Metadata } from "next";
import {
  LEGAL_DRAFT_BANNER,
  LEGAL_PUBLICATION_MODE,
  getLegalRobots,
  isLegalDraftMode,
} from "@/features/legal";

export function buildLegalPageMetadata(input: {
  readonly title: string;
  readonly description: string;
  readonly path: string;
}): Metadata {
  const robots = getLegalRobots();
  const draftPrefix = isLegalDraftMode() ? "Draft — " : "";

  return {
    title: `${draftPrefix}${input.title} | ONEDECORE`,
    description: isLegalDraftMode()
      ? `${LEGAL_DRAFT_BANNER} ${input.description}`
      : input.description,
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
    openGraph: isLegalDraftMode()
      ? {
          title: `Draft — ${input.title}`,
          description: LEGAL_DRAFT_BANNER,
          type: "website",
        }
      : {
          title: input.title,
          description: input.description,
          type: "website",
        },
    other: {
      "od-legal-publication-mode": LEGAL_PUBLICATION_MODE,
    },
  };
}
