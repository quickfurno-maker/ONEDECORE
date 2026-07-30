import type { Metadata } from "next";
import { TERMS_OF_USE_CONTENT } from "@/features/legal";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import {
  LegalPageShell,
  LegalParagraphs,
  LegalSection,
} from "@/features/legal/components/LegalPageShell";

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Terms of Use",
  description:
    "Draft terms of use for the ONEDECORE public website. Not yet effective.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Use"
      description="Draft website terms. Prices are indicative; the current planner does not submit leads or create bookings."
      sections={TERMS_OF_USE_CONTENT}
    >
      {TERMS_OF_USE_CONTENT.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          <LegalParagraphs lines={section.body} />
        </LegalSection>
      ))}
    </LegalPageShell>
  );
}
