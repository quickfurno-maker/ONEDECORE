import type { Metadata } from "next";
import { buildLegalPageMetadata } from "@/features/legal/legal-metadata";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import { LegalPageShell, LegalParagraphs, LegalSection } from "@/features/legal/components/LegalPageShell";
import { SHIPPING_DELIVERY_SECTIONS, COMMERCE_POLICY_EFFECTIVE_DATE, COMMERCE_POLICY_VERSIONS } from "@/features/commerce/public/commerce-policy";

export const revalidate = 300;

export const metadata: Metadata = buildLegalPageMetadata({
  title: "Shipping & Delivery Policy",
  description: "How ONEDECORE handles serviceability, delivery estimates, shipping charges, access and furniture delivery support.",
  path: "/shipping-delivery",
  published: isShopPublicEnabled(),
});

export default function Page() {
  const sections = SHIPPING_DELIVERY_SECTIONS;
  return (
    <LegalPageShell
      title="Shipping & Delivery Policy"
      description="How ONEDECORE handles serviceability, delivery estimates, shipping charges, access and furniture delivery support."
      sections={sections}
      documentVersion={COMMERCE_POLICY_VERSIONS.shippingDelivery}
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
