import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { RelatedSeoLinks } from "@/features/seo/RelatedSeoLinks";

export const metadata: Metadata = {
  title: `Interior Design Services in Pune — ${SITE_CONFIG.name}`,
  description:
    "Explore ONEDECORE services for complete home interiors, modular kitchens, custom wardrobes and home renovation in Pune.",
  alternates: { canonical: absoluteUrl("services") },
};

const services = [
  ["Complete Home Interiors", "/services/complete-home-interiors", "Plan design, manufacturing and installation with one coordinated team."],
  ["Modular Kitchens", "/services/modular-kitchens", "Plan kitchen storage, workflow, materials and finishes around your home."],
  ["Custom Wardrobes", "/services/wardrobes", "Made-to-fit wardrobe planning for practical everyday storage."],
  ["Home Renovation", "/services/home-renovation", "Coordinate renovation, civil work, ceilings and electrical work together."],
] as const;

export default function ServicesPage() {
  return (
    <main className="od-portfolio-main">
      <header className="od-portfolio-header">
        <p className="od-portfolio-eyebrow">ONEDECORE Services</p>
        <h1 className="od-portfolio-title">Interior design services for homes in Pune.</h1>
        <p className="od-portfolio-lede">Explore the core interior scopes ONEDECORE plans and delivers.</p>
      </header>
      <section className="od-prose od-detail-section" aria-label="Interior design services">
        {services.map(([title, href, description]) => (
          <article key={href}>
            <h2><Link href={href}>{title}</Link></h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
      <RelatedSeoLinks exclude={["/services/complete-home-interiors", "/services/modular-kitchens", "/services/wardrobes", "/services/home-renovation"]} />
    </main>
  );
}
