import Link from "next/link";
import { buildCommercePublicUrl } from "@/features/commerce/public/public-url";
import { VendorIcon } from "@/features/commerce/vendor/components/VendorIcon";
import { listMyVendorProducts } from "@/features/commerce/vendor/vendor-queries";
import { vendorStatusLabel } from "@/features/commerce/vendor/vendor-domain";

function money(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function statusTone(status: string): string {
  if (status === "approved") return "bg-[#e4f1e6] text-[#356443]";
  if (status === "pending_review") return "bg-[#fff0ca] text-[#8c641f]";
  if (status === "changes_requested") return "bg-[#f8ded9] text-[#9b5048]";
  if (status === "rejected") return "bg-[#f4dddd] text-[#9b4848]";
  return "bg-[#e8ecef] text-[#55616b]";
}

export default async function VendorProductsPage() {
  const rows = await listMyVendorProducts();
  const approved = rows.filter((row) => row.vendor_submission_status === "approved").length;
  const attention = rows.filter((row) => row.vendor_submission_status === "changes_requested" || row.vendor_submission_status === "rejected").length;
  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--vendor-green)]">Catalogue workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">My Products</h1><p className="mt-2 text-sm text-[var(--od-text-2)]">Create, improve and follow every product through OneDecore review.</p></div>
        <Link href="/vendor/products/new" className="vendor-primary-button"><VendorIcon name="add" className="h-4 w-4"/>Add product</Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="vendor-panel-flat p-4"><p className="text-xs text-[var(--od-muted)]">Total products</p><p className="mt-1 text-2xl font-semibold">{rows.length}</p></div>
        <div className="vendor-panel-flat p-4"><p className="text-xs text-[var(--od-muted)]">Approved</p><p className="mt-1 text-2xl font-semibold text-[#456b50]">{approved}</p></div>
        <div className="vendor-panel-flat p-4"><p className="text-xs text-[var(--od-muted)]">Needs attention</p><p className="mt-1 text-2xl font-semibold text-[#ad6351]">{attention}</p></div>
      </section>
      {rows.length === 0 ? (
        <section className="vendor-panel p-10 text-center"><VendorIcon name="products" className="mx-auto h-10 w-10 text-[#998a7a]"/><h2 className="mt-4 text-base font-semibold">Start your product catalogue</h2><p className="mx-auto mt-1 max-w-md text-sm text-[var(--od-muted)]">Add product details and photos, then submit them to OneDecore for catalogue review.</p><Link href="/vendor/products/new" className="vendor-primary-button mt-5">Add first product</Link></section>
      ) : (
        <section className="vendor-panel overflow-hidden">
          <div className="hidden grid-cols-[minmax(300px,1.4fr)_140px_150px_120px_150px_44px] gap-4 border-b border-[var(--vendor-border)] bg-[#faf6f1] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--od-muted)] lg:grid">
            <span>Product</span><span>Price</span><span>Availability</span><span>Photos</span><span>Review</span><span />
          </div>
          <div className="divide-y divide-[var(--vendor-border)]">
            {rows.map((row) => {
              const image = buildCommercePublicUrl(row.primaryImagePath);
              const stockLabel = row.availabilityMode === "made_to_order"
                ? (row.vendor_sales_enabled ? "Made to order" : "Sales paused")
                : row.vendor_stock_status === "out_of_stock" || !row.vendor_sales_enabled
                  ? "Unavailable"
                  : `${row.availableQty} available`;
              return (
                <Link key={row.id} href={`/vendor/products/${row.id}`} className="group grid gap-4 px-4 py-4 transition hover:bg-[#fcf8f3] sm:px-5 lg:grid-cols-[minmax(300px,1.4fr)_140px_150px_120px_150px_44px] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#ece5dc]">
                      {image ? <div role="img" aria-label={row.name} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} /> : <div className="grid h-full place-items-center text-[#9b8c7d]"><VendorIcon name="package" className="h-6 w-6"/></div>}
                    </div>
                    <div className="min-w-0"><p className="truncate text-sm font-semibold group-hover:text-[var(--vendor-green)]">{row.name}</p><p className="mt-1 truncate text-[11px] text-[var(--od-muted)]">{row.sku} · {row.product_reference}</p>{row.review_note && ["changes_requested","rejected"].includes(row.vendor_submission_status) ? <p className="mt-1 line-clamp-1 text-[11px] text-[#a05b4f]">{row.review_note}</p> : null}</div>
                  </div>
                  <div><p className="text-[10px] uppercase tracking-[.08em] text-[var(--od-muted)] lg:hidden">Price</p><p className="mt-1 text-sm font-semibold lg:mt-0">{money(row.sellingPricePaise)}</p></div>
                  <div><p className="text-[10px] uppercase tracking-[.08em] text-[var(--od-muted)] lg:hidden">Availability</p><p className="mt-1 text-sm lg:mt-0">{stockLabel}</p></div>
                  <div><p className="text-[10px] uppercase tracking-[.08em] text-[var(--od-muted)] lg:hidden">Photos</p><p className="mt-1 text-sm lg:mt-0">{row.imageCount}</p></div>
                  <div><span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-semibold ${statusTone(row.vendor_submission_status)}`}>{vendorStatusLabel(row.vendor_submission_status)}</span></div>
                  <VendorIcon name="arrow" className="hidden h-4 w-4 text-[var(--od-muted)] transition group-hover:translate-x-0.5 lg:block" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
