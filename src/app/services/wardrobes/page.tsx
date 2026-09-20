import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: `Custom Wardrobes in Pune — ${SITE_CONFIG.name}`,
  description: "Plan custom wardrobes in Pune with ONEDECORE, with made-to-fit storage, internal zoning, lofts and finishes for your room.",
  alternates: { canonical: absoluteUrl("services/wardrobes") },
};

export default function Page() {
  return <main className="od-portfolio-main"><header className="od-portfolio-header"><p className="od-portfolio-eyebrow">Custom Wardrobes</p><h1 className="od-portfolio-title">Custom wardrobes in Pune, made to fit your home.</h1><p className="od-portfolio-lede">Storage planned around your room, belongings and daily routine.</p></header><section className="od-prose od-detail-section"><h2>Storage planned from the inside out</h2><p>Wardrobe planning can account for internal zoning, loft storage, hardware and finishes while staying coordinated with the rest of the room.</p><p><Link href="/portfolio?view=bedroom">Explore bedroom interiors</Link> or <Link href="/#consultation">start a free consultation</Link>.</p></section></main>;
}
