import type { Metadata } from "next";
import { ConversionMaster } from "@/features/design-concepts/conversion-master/ConversionMaster";
import { loadConceptFeatured } from "@/features/design-concepts/server/featured";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ONEDECORE — Conversion Master (Phase 2F-R3 internal review)",
  description:
    "Conversion-focused homepage prototype for Phase 2F-R3 owner review. Internal only.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function ConversionMasterPage() {
  const featured = await loadConceptFeatured();

  return <ConversionMaster featured={featured} />;
}
