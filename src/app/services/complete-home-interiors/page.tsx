import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: `Complete Home Interiors in Pune — ${SITE_CONFIG.name}`,
  description: "Plan complete home interiors in Pune with ONEDECORE, from layouts and finishes through manufacturing, installation and handover.",
  alternates: { canonical: absoluteUrl("services/complete-home-interiors") },
};

export default function Page() {
  return <main className="od-portfolio-main"><header className="od-portfolio-header"><p className="od-portfolio-eyebrow">Complete Home Interiors</p><h1 className="od-portfolio-title">Complete home interiors in Pune.</h1><p className="od-portfolio-lede">A coordinated interior journey covering design, manufacturing and installation for your home.</p></header><section className="od-prose od-detail-section"><h2>Plan the complete home as one project</h2><p>ONEDECORE brings the major interior scopes together so layouts, storage, finishes and execution can be planned as a connected whole.</p><h2>Explore delivered interiors</h2><p><Link href="/portfolio?view=projects">View complete interior projects</Link> or <Link href="/#consultation">start a free consultation</Link>.</p></section></main>;
}
