import type { Metadata } from "next";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import { LegalPageShell, LegalParagraphs, LegalSection } from "@/features/legal/components/LegalPageShell";
import { RETURNS_REFUNDS_SECTIONS, COMMERCE_POLICY_EFFECTIVE_DATE, COMMERCE_POLICY_VERSIONS } from "@/features/commerce/public/commerce-policy";

export const revalidate = 300;

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Returns & Refunds Policy",
  description: "Return, inspection and refund rules for ready-made furniture ordered from the ONEDECORE shop.",
  path: "/returns-refunds",
  published: isShopPublicEnabled(),
});

export default function Page() {
  const sections = RETURNS_REFUNDS_SECTIONS;
  return (
    <LegalPageShell
      title="Returns & Refunds Policy"
      description="Return, inspection and refund rules for ready-made furniture ordered from the ONEDECORE shop."
      sections={sections}
      documentVersion={COMMERCE_POLICY_VERSIONS.returnsRefunds}
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
