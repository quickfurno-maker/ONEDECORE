import type { Metadata } from "next";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import { LegalPageShell, LegalParagraphs, LegalSection } from "@/features/legal/components/LegalPageShell";
import { CANCELLATION_SECTIONS, COMMERCE_POLICY_EFFECTIVE_DATE, COMMERCE_POLICY_VERSIONS } from "@/features/commerce/public/commerce-policy";

export const revalidate = 300;

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Cancellation Policy",
  description: "How cancellation requests are handled for ready-stock and made-to-order furniture purchases.",
  path: "/cancellation",
  published: isShopPublicEnabled(),
});

export default function Page() {
  const sections = CANCELLATION_SECTIONS;
  return (
    <LegalPageShell
      title="Cancellation Policy"
      description="How cancellation requests are handled for ready-stock and made-to-order furniture purchases."
      sections={sections}
      documentVersion={COMMERCE_POLICY_VERSIONS.cancellation}
      effectiveDateLabel={COMMERCE_POLICY_EFFECTIVE_DATE}
    >
      {sections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          <LegalParagraphs lines={section.body} />
        </LegalSection>
      ))}
    </LegalPageShell>
  );
}
