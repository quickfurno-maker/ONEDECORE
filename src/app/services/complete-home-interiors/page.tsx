import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { ServiceSeoShell } from "@/features/seo/ServiceSeoShell";

export const metadata: Metadata = { title: `Complete Home Interiors in Pune — ${SITE_CONFIG.name}`, description: "A coordinated interior journey covering design, manufacturing and installation for your home.", alternates: { canonical: absoluteUrl("services/complete-home-interiors") } };

export default function Page() { return <ServiceSeoShell name="Complete Home Interiors" path="services/complete-home-interiors" eyebrow="Complete Home Interiors" title="Complete home interiors in Pune." description="A coordinated interior journey covering design, manufacturing and installation for your home."><h2>Plan the complete home as one project</h2><p>ONEDECORE brings the major interior scopes together so layouts, storage, finishes and execution can be planned as a connected whole.</p><h2>Explore delivered interiors</h2><p><Link href="/portfolio?view=projects">View complete interior projects</Link> or <Link href="/#consultation">start a free consultation</Link>.</p></ServiceSeoShell>; }
