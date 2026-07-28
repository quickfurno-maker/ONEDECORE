import type { Metadata } from "next";
import { PremiumMotionHomepage } from "@/features/design-concepts/premium-motion/PremiumMotionHomepage";
import { loadConceptFeatured } from "@/features/design-concepts/server/featured";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ONEDECORE — Premium Motion Homepage (Phase 2F-R4 internal review)",
  description:
    "Premium motion conversion homepage prototype for Phase 2F-R4 owner review. Internal only.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function PremiumMotionHomepagePage() {
  const featured = await loadConceptFeatured();

  return <PremiumMotionHomepage featured={featured} />;
}
