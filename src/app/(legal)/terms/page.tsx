import type { Metadata } from "next";
import {
  getTermsOfUseDisplayVersion,
  getTermsOfUseEffectiveDateLabel,
  getTermsOfUseSections,
  isLegalDraftMode,
  isLegalOwnerApprovedMode,
} from "@/features/legal";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import {
  LegalPageShell,
  LegalParagraphs,
  LegalSection,
} from "@/features/legal/components/LegalPageShell";

const sections = getTermsOfUseSections();

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Terms of Use",
  description: isLegalDraftMode()
    ? "Draft terms of use for owner review. Not yet effective."
    : isLegalOwnerApprovedMode()
      ? "Owner-approved terms of use. Not yet effective."
      : "Terms of use for the ONEDECORE public website.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Use"
      description={
        isLegalDraftMode()
          ? "Draft for owner review. Customer-facing published copy is prepared; this page still shows draft-review chrome until publication is authorized."
          : isLegalOwnerApprovedMode()
            ? "Owner-approved customer-facing copy. Not yet the effective published policy."
            : "Terms governing use of the ONEDECORE public website."
      }
      sections={sections}
      documentVersion={getTermsOfUseDisplayVersion()}
      effectiveDateLabel={getTermsOfUseEffectiveDateLabel()}
    >
      {sections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          <LegalParagraphs lines={section.body} />
        </LegalSection>
      ))}
    </LegalPageShell>
  );
}
