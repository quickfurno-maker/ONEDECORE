import type { ReactNode } from "react";
import Link from "next/link";
import { getServiceJsonLd } from "./service-schema";

export function ServiceSeoShell({
  name,
  path,
  eyebrow,
  title,
  description,
  children,
}: {
  readonly name: string;
  readonly path: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  const jsonLd = getServiceJsonLd({ name, path, description });
  return (
    <main className="od-portfolio-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="od-portfolio-eyebrow">
        <Link href="/">Home</Link> / <Link href="/services">Services</Link> / <span>{name}</span>
      </nav>
      <header className="od-portfolio-header">
        <p className="od-portfolio-eyebrow">{eyebrow}</p>
        <h1 className="od-portfolio-title">{title}</h1>
        <p className="od-portfolio-lede">{description}</p>
      </header>
      <section className="od-prose od-detail-section">{children}</section>
    </main>
  );
}
