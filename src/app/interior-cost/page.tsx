import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { RelatedSeoLinks } from "@/features/seo/RelatedSeoLinks";

export const metadata: Metadata = {
  title: `Interior Design Cost in Pune — ${SITE_CONFIG.name}`,
  description: "Understand the main factors that shape home interior and modular kitchen budgets in Pune, and explore ONEDECORE's planning guides.",
  alternates: { canonical: absoluteUrl("interior-cost") },
};

export default function Page() {
  return <main className="od-portfolio-main"><header className="od-portfolio-header"><p className="od-portfolio-eyebrow">Planning Guide</p><h1 className="od-portfolio-title">Interior design cost in Pune.</h1><p className="od-portfolio-lede">A practical starting point for understanding what shapes an interior budget before a detailed quotation.</p></header><section className="od-prose od-detail-section"><h2>What changes the cost?</h2><p>Home size, project scope, materials, hardware, storage requirements, finishes and site conditions all affect the final quotation.</p><h2>Choose a planning guide</h2><p><Link href="/interior-cost/2bhk-interior-cost-pune">2 BHK interior cost in Pune</Link></p><p><Link href="/interior-cost/3bhk-interior-cost-pune">3 BHK interior cost in Pune</Link></p><p><Link href="/interior-cost/modular-kitchen-cost-pune">Modular kitchen cost in Pune</Link></p><p>For a project-specific discussion, <Link href="/#consultation">start a free consultation</Link>.</p></section><RelatedSeoLinks exclude={["/interior-cost"]} /></main>;
}
