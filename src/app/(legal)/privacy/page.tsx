import type { Metadata } from "next";
import {
  getPrivacyNoticeDisplayVersion,
  getPrivacyNoticeEffectiveDateLabel,
  getPrivacyPolicySections,
  isLegalDraftMode,
} from "@/features/legal";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import {
  LegalPageShell,
  LegalParagraphs,
  LegalSection,
} from "@/features/legal/components/LegalPageShell";

const sections = getPrivacyPolicySections();

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Privacy Notice",
  description: isLegalDraftMode()
    ? "Draft privacy notice for owner review. Not yet effective."
    : "How ONEDECORE handles personal data for website enquiries and related service operations.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Notice"
      description={
        isLegalDraftMode()
          ? "Draft for owner review. Customer-facing published copy is prepared; this page still shows draft-review chrome until publication is authorized."
          : "How ONEDECORE handles personal data for website enquiries, CRM follow-up and related service operations."
      }
      sections={sections}
      documentVersion={getPrivacyNoticeDisplayVersion()}
      effectiveDateLabel={getPrivacyNoticeEffectiveDateLabel()}
    >
      {sections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          <LegalParagraphs lines={section.body} />
        </LegalSection>
      ))}
    </LegalPageShell>
  );
}
