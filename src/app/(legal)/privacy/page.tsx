import type { Metadata } from "next";
import {
  PRIVACY_POLICY_CONTENT,
} from "@/features/legal";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import {
  LegalPageShell,
  LegalParagraphs,
  LegalSection,
} from "@/features/legal/components/LegalPageShell";

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Privacy Notice",
  description:
    "Draft privacy notice describing how ONEDECORE intends to handle personal data. Not yet effective.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Notice"
      description="Draft for owner and Indian legal counsel review. Designed for DPDP readiness; not a compliance claim."
      sections={PRIVACY_POLICY_CONTENT}
    >
      {PRIVACY_POLICY_CONTENT.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          <LegalParagraphs lines={section.body} />
        </LegalSection>
      ))}
    </LegalPageShell>
  );
}
