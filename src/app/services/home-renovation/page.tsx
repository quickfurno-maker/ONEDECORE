import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { ServiceSeoShell } from "@/features/seo/ServiceSeoShell";

export const metadata: Metadata = { title: `Home Renovation in Pune — ${SITE_CONFIG.name}`, description: "Bring layout changes, civil work, ceilings, electrical work and interiors into one planning process.", alternates: { canonical: absoluteUrl("services/home-renovation") } };

export default function Page() { return <ServiceSeoShell name="Home Renovation" path="services/home-renovation" eyebrow="Home Renovation" title="Home renovation in Pune, coordinated as one project." description="Bring layout changes, civil work, ceilings, electrical work and interiors into one planning process."><h2>Coordinate renovation and interiors</h2><p>A connected scope helps design decisions and site execution stay aligned from planning through installation.</p><p><Link href="/portfolio?view=projects">Explore completed projects</Link> or <Link href="/#consultation">start a free consultation</Link>.</p></ServiceSeoShell>; }
