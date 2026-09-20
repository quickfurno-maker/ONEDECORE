import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { ServiceSeoShell } from "@/features/seo/ServiceSeoShell";

export const metadata: Metadata = { title: `Custom Wardrobes in Pune — ${SITE_CONFIG.name}`, description: "Storage planned around your room, belongings and daily routine.", alternates: { canonical: absoluteUrl("services/wardrobes") } };

export default function Page() { return <ServiceSeoShell name="Custom Wardrobes" path="services/wardrobes" eyebrow="Custom Wardrobes" title="Custom wardrobes in Pune, made to fit your home." description="Storage planned around your room, belongings and daily routine."><h2>Storage planned from the inside out</h2><p>Wardrobe planning can account for internal zoning, loft storage, hardware and finishes while staying coordinated with the rest of the room.</p><p><Link href="/portfolio?view=bedroom">Explore bedroom interiors</Link> or <Link href="/#consultation">start a free consultation</Link>.</p></ServiceSeoShell>; }
