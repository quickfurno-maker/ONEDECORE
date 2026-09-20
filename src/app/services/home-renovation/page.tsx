import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: `Home Renovation in Pune — ${SITE_CONFIG.name}`,
  description: "Plan home renovation in Pune with ONEDECORE, coordinating interior design, civil work, ceilings and electrical work in one scope.",
  alternates: { canonical: absoluteUrl("services/home-renovation") },
};

export default function Page() {
  return <main className="od-portfolio-main"><header className="od-portfolio-header"><p className="od-portfolio-eyebrow">Home Renovation</p><h1 className="od-portfolio-title">Home renovation in Pune, coordinated as one project.</h1><p className="od-portfolio-lede">Bring layout changes, civil work, ceilings, electrical work and interiors into one planning process.</p></header><section className="od-prose od-detail-section"><h2>Coordinate renovation and interiors</h2><p>A connected scope helps design decisions and site execution stay aligned from planning through installation.</p><p><Link href="/portfolio?view=projects">Explore completed projects</Link> or <Link href="/#consultation">start a free consultation</Link>.</p></section></main>;
}
