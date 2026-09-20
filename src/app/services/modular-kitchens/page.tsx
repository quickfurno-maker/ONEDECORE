import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { ServiceSeoShell } from "@/features/seo/ServiceSeoShell";

export const metadata: Metadata = { title: `Modular Kitchens in Pune — ${SITE_CONFIG.name}`, description: "Storage, workflow and finishes planned together for a practical kitchen.", alternates: { canonical: absoluteUrl("services/modular-kitchens") } };

export default function Page() { return <ServiceSeoShell name="Modular Kitchens" path="services/modular-kitchens" eyebrow="Modular Kitchens" title="Modular kitchens in Pune, planned around how you cook." description="Storage, workflow and finishes planned together for a practical kitchen."><h2>Kitchen planning that starts with everyday use</h2><p>Plan storage zones, work flow and finishes around your room and routine instead of forcing a standard catalogue layout.</p><h2>See kitchen work</h2><p><Link href="/portfolio">Explore the kitchen portfolio</Link> or <Link href="/#consultation">start a free consultation</Link>.</p></ServiceSeoShell>; }
