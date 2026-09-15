import type { Metadata } from "next";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import { LegalPageShell, LegalParagraphs, LegalSection } from "@/features/legal/components/LegalPageShell";
import { PRODUCT_WARRANTY_SECTIONS, COMMERCE_POLICY_EFFECTIVE_DATE, COMMERCE_POLICY_VERSIONS } from "@/features/commerce/public/commerce-policy";

export const revalidate = 300;

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Product Warranty Policy",
  description: "Retail furniture warranty scope, claims and the relationship between written warranties and statutory consumer rights.",
  path: "/product-warranty",
  published: isShopPublicEnabled(),
});

export default function Page() {
  const sections = PRODUCT_WARRANTY_SECTIONS;
  return (
    <LegalPageShell
      title="Product Warranty Policy"
      description="Retail furniture warranty scope, claims and the relationship between written warranties and statutory consumer rights."
      sections={sections}
      documentVersion={COMMERCE_POLICY_VERSIONS.productWarranty}
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
