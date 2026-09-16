import Link from "next/link";
import { listMyVendorProducts } from "@/features/commerce/vendor/vendor-queries";
import { vendorStatusLabel } from "@/features/commerce/vendor/vendor-domain";

export default async function VendorDashboardPage() {
  const products = await listMyVendorProducts();
  const counts = {
    total: products.length,
    draft: products.filter((row) => row.vendor_submission_status === "draft" || row.vendor_submission_status === "changes_requested").length,
    review: products.filter((row) => row.vendor_submission_status === "pending_review").length,
    approved: products.filter((row) => row.vendor_submission_status === "approved").length,
  };
  const recent = products.slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Dashboard</h1><p className="mt-1 text-sm text-[var(--od-muted)]">Track product submissions and review progress.</p></div>
        <Link href="/vendor/products/new" className="inline-flex min-h-11 items-center rounded-lg bg-[var(--od-gold)] px-4 text-sm font-semibold text-black">Add product</Link>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Products", counts.total], ["Editable", counts.draft], ["Under review", counts.review], ["Approved", counts.approved]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-4"><p className="text-xs text-[var(--od-muted)]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>
        ))}
      </section>
      <section className="rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--od-border)] px-4 py-3"><h2 className="text-sm font-semibold">Recent products</h2><Link href="/vendor/products" className="text-xs text-[var(--od-gold)]">View all</Link></div>
        {recent.length === 0 ? <p className="p-6 text-sm text-[var(--od-muted)]">No products yet. Add your first product to begin.</p> : (
          <ul className="divide-y divide-[var(--od-border)]">
            {recent.map((row) => <li key={row.id}><Link href={`/vendor/products/${row.id}`} className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--od-hover)]"><div><p className="text-sm font-medium">{row.name}</p><p className="text-xs text-[var(--od-muted)]">{row.product_reference} · {row.sku}</p></div><span className="text-xs text-[var(--od-text-2)]">{vendorStatusLabel(row.vendor_submission_status)}</span></Link></li>)}
          </ul>
        )}
      </section>
      <aside className="rounded-xl border border-[var(--od-border)] bg-[var(--od-elevated)] p-4 text-sm text-[var(--od-text-2)]">
        OneDecore controls catalogue category, tax, HSN/SAC, SEO, shipping and publication. Your workspace is limited to product information, price, stock mode and photos.
      </aside>
    </div>
  );
}
