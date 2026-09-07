import type { Metadata } from "next";
import {
  getPrivacyNoticeDisplayVersion,
  getPrivacyNoticeEffectiveDateLabel,
  getPrivacyPolicySections,
  isLegalDraftMode,
  isLegalOwnerApprovedMode,
} from "@/features/legal";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import {
  LegalPageShell,
  LegalParagraphs,
  LegalSection,
} from "@/features/legal/components/LegalPageShell";

const sections = getPrivacyPolicySections();

/**
 * Public marketing HTML must not be cacheable for a year by a shared cache.
 *
 * Next.js requires this to be a literal: a route segment config is read by
 * static analysis rather than by running the module, so an imported constant is
 * rejected outright. The decision therefore lives in
 * `PUBLIC_HTML_REVALIDATE_SECONDS` and a test asserts every public page's
 * literal still equals it. See `src/config/public-cache.ts`.
 */
export const revalidate = 300;

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Privacy Notice",
  description: isLegalDraftMode()
    ? "Draft privacy notice for owner review. Not yet effective."
    : isLegalOwnerApprovedMode()
      ? "Owner-approved privacy notice. Not yet effective."
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
          : isLegalOwnerApprovedMode()
            ? "Owner-approved customer-facing copy. Not yet the effective published policy."
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
