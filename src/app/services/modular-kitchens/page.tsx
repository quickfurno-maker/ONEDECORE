import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: `Modular Kitchens in Pune — ${SITE_CONFIG.name}`,
  description: "Plan a modular kitchen in Pune with ONEDECORE, with practical storage, workflow, materials and finishes designed around your home.",
  alternates: { canonical: absoluteUrl("services/modular-kitchens") },
};

export default function Page() {
  return <main className="od-portfolio-main"><header className="od-portfolio-header"><p className="od-portfolio-eyebrow">Modular Kitchens</p><h1 className="od-portfolio-title">Modular kitchens in Pune, planned around how you cook.</h1><p className="od-portfolio-lede">Storage, workflow and finishes planned together for a practical kitchen.</p></header><section className="od-prose od-detail-section"><h2>Kitchen planning that starts with everyday use</h2><p>Plan storage zones, work flow and finishes around your room and routine instead of forcing a standard catalogue layout.</p><h2>See kitchen work</h2><p><Link href="/portfolio">Explore the kitchen portfolio</Link> or <Link href="/#consultation">start a free consultation</Link>.</p></section></main>;
}
