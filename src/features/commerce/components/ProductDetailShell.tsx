import Link from "next/link";
import type { ReactNode } from "react";
import type { CommerceProductDetail } from "../server/commerce-queries.ts";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts.ts";

const nav = [
  { href: "#overview", label: "Overview" },
  { href: "#variants", label: "Variants & Pricing" },
  { href: "#media", label: "Media" },
  { href: "#inventory", label: "Inventory" },
  { href: "#specifications", label: "Specifications" },
  { href: "#seo", label: "SEO" },
  { href: "#related", label: "Related Products" },
];

export function ProductDetailShell({
  detail,
  children,
  railActions,
}: {
  readonly detail: CommerceProductDetail;
  readonly children: ReactNode;
  readonly railActions: ReactNode;
}) {
  const starting = detail.variants
    .filter((row) => row.status === "active")
    .reduce<number | null>((acc, row) => {
      if (acc === null || row.selling_price_paise < acc) return row.selling_price_paise;
      return acc;
    }, null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
      <div className="min-w-0 space-y-6">
        <nav aria-label="Product sections" className="flex flex-wrap gap-2">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-9 items-center rounded-[8px] border border-[var(--od-border)] px-3 text-xs text-[var(--od-text-2)] hover:border-[var(--od-gold)]/40 hover:text-[var(--od-text)]"
            >
              {item.label}
            </a>
          ))}
        </nav>
        {children}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <section className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--od-text)]">Publication</h2>
          <p className="mt-2 text-sm capitalize text-[var(--od-text-2)]">{detail.product.status}</p>
          <p className="mt-1 text-xs text-[var(--od-muted)]">
            Storefront readiness: {detail.publicationReady ? "Ready to publish" : "Not ready"}
          </p>
          {detail.product.published_at ? (
            <p className="mt-1 text-xs text-[var(--od-muted)]">
              Published {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(detail.product.published_at))}
            </p>
          ) : null}
        </section>
        <section className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-[var(--od-muted)]">Category</p>
          <p className="mt-1 text-[var(--od-text)]">{detail.category?.name ?? "Uncategorised"}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--od-muted)]">Featured</p>
          <p className="mt-1">{detail.product.featured ? "Yes" : "No"}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--od-muted)]">Starting price</p>
          <p className="mt-1">{starting == null ? "—" : formatInrFromPaise(starting)}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--od-muted)]">Updated</p>
          <p className="mt-1 text-[var(--od-muted)]">
            {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(detail.product.updated_at)
            )}
          </p>
        </section>
        {railActions}
        <Link href="/admin/commerce/products" className="block text-xs text-[var(--od-gold)]">
          Back to products
        </Link>
      </aside>
    </div>
  );
}

export function ProductSection({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-3 rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-5">
      <h2 className="text-[17px] font-semibold text-[var(--od-text)]">{title}</h2>
      {children}
    </section>
  );
}
