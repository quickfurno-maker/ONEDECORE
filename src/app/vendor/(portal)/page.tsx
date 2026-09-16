import Link from "next/link";
import { buildCommercePublicUrl } from "@/features/commerce/public/public-url";
import { VendorIcon, type VendorIconName } from "@/features/commerce/vendor/components/VendorIcon";
import { vendorStatusLabel } from "@/features/commerce/vendor/vendor-domain";
import { listMyVendorOrders } from "@/features/commerce/vendor/vendor-orders";
import { listMyVendorProducts } from "@/features/commerce/vendor/vendor-queries";
import { requireCommerceVendor } from "@/features/commerce/vendor/vendor-auth";

function money(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function productTone(status: string): string {
  if (status === "approved") return "bg-[#e4f1e6] text-[#356443]";
  if (status === "pending_review") return "bg-[#fff0ca] text-[#8c641f]";
  if (status === "changes_requested") return "bg-[#f8ded9] text-[#9b5048]";
  if (status === "rejected") return "bg-[#f4dddd] text-[#9b4848]";
  return "bg-[#e8ecef] text-[#55616b]";
}

function orderLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function VendorDashboardPage() {
  const [vendor, products, orders] = await Promise.all([
    requireCommerceVendor(),
    listMyVendorProducts(),
    listMyVendorOrders(8),
  ]);
  const counts = {
    total: products.length,
    approved: products.filter((row) => row.vendor_submission_status === "approved").length,
    review: products.filter((row) => row.vendor_submission_status === "pending_review").length,
    draft: products.filter((row) => row.vendor_submission_status === "draft" || row.vendor_submission_status === "changes_requested").length,
    out: products.filter((row) => row.vendor_stock_status === "out_of_stock" || !row.vendor_sales_enabled).length,
  };
  const attention = products.filter((row) => row.vendor_submission_status === "changes_requested" || row.vendor_submission_status === "rejected").slice(0, 3);
  const recentProducts = products.slice(0, 4);
  const recentOrders = orders.slice(0, 4);
  const kpis: readonly [string, number, VendorIconName, string, string][] = [
    ["Total Products", counts.total, "package", "bg-[#f5e9df] text-[#a46436]", "All submissions"],
    ["Approved", counts.approved, "check", "bg-[#e6f2e6] text-[#3f764d]", "Ready after publication"],
    ["Under Review", counts.review, "clock", "bg-[#fff0dc] text-[#b16f32]", "With OneDecore"],
    ["Drafts", counts.draft, "draft", "bg-[#edf0f2] text-[#53606a]", "Editable by you"],
    ["Unavailable", counts.out, "warning", "bg-[#f5e7dd] text-[#a55b3b]", "Stock or sales paused"],
  ];
  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="vendor-panel overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-8 xl:p-9">
            <p className="text-sm font-medium text-[var(--vendor-green)]">Welcome back,</p>
            <h1 className="mt-1 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-[var(--od-text)] sm:text-[38px]">{vendor.displayName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--od-text-2)]">Manage products, stock and orders from one focused workspace.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/vendor/products/new" className="vendor-primary-button"><VendorIcon name="add" className="h-4 w-4" />Add new product</Link>
              <Link href="/vendor/stock" className="vendor-secondary-button"><VendorIcon name="stock" className="h-4 w-4" />Manage stock</Link>
            </div>
          </div>
          <div className="relative min-h-44 overflow-hidden border-t border-[var(--vendor-border)] bg-[#e9e2d8] p-6 xl:border-l xl:border-t-0">
            <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-[#d8c5b2]/60" />
            <div className="absolute bottom-[-55px] right-12 h-40 w-40 rounded-full bg-[#b9c8b8]/55" />
            <div className="relative flex h-full flex-col justify-between">
              <p className="max-w-[240px] font-serif text-xl leading-8 text-[#334038]">“Beautiful products deserve a beautifully managed journey.”</p>
              <div className="mt-5"><p className="text-xs font-semibold text-[#4e5c53]">OneDecore</p><p className="mt-1 text-[11px] text-[#748077]">Vendor code {vendor.vendorCode}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(([label, value, icon, tone, detail]) => (
          <div key={label} className="vendor-panel-flat p-4.5 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-medium text-[var(--od-text-2)]">{label}</p><p className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">{value}</p></div>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><VendorIcon name={icon} className="h-5 w-5" /></span>
            </div>
            <p className="mt-3 text-[11px] text-[var(--od-muted)]">{detail}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
        <section className="vendor-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="text-base font-semibold tracking-[-0.01em]">Recent products</h2><p className="mt-1 text-xs text-[var(--od-muted)]">Your latest product activity and review state.</p></div>
            <Link href="/vendor/products" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--vendor-green)]">View all <VendorIcon name="arrow" className="h-3.5 w-3.5" /></Link>
          </div>
          {recentProducts.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--vendor-border-strong)] p-8 text-center">
              <p className="text-sm font-medium">No products yet</p><p className="mt-1 text-xs text-[var(--od-muted)]">Add your first product to start your catalogue workflow.</p>
              <Link href="/vendor/products/new" className="vendor-primary-button mt-4">Add product</Link>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              {recentProducts.map((product) => {
                const image = buildCommercePublicUrl(product.primaryImagePath);
                return (
                  <Link key={product.id} href={`/vendor/products/${product.id}`} className="group min-w-0">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#ece5dc]">
                      {image ? <div role="img" aria-label={product.name} className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-[1.025]" style={{ backgroundImage: `url(${image})` }} /> : <div className="grid h-full place-items-center text-[#9b8c7d]"><VendorIcon name="package" className="h-9 w-9" /></div>}
                      <span className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-[10px] font-semibold shadow-sm ${productTone(product.vendor_submission_status)}`}>{vendorStatusLabel(product.vendor_submission_status)}</span>
                    </div>
                    <div className="pt-3"><p className="truncate text-sm font-semibold group-hover:text-[var(--vendor-green)]">{product.name}</p><p className="mt-1 truncate text-[11px] text-[var(--od-muted)]">{product.sku} · {product.product_reference}</p><p className="mt-2 text-sm font-semibold">{money(product.sellingPricePaise)}</p></div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <aside className="vendor-panel p-5 sm:p-6">
          <div className="flex items-center gap-2"><VendorIcon name="add" className="h-4 w-4 text-[var(--vendor-warm)]"/><h2 className="text-base font-semibold">Quick actions</h2></div>
          <div className="mt-4 space-y-2.5">
            <Link href="/vendor/products/new" className="vendor-primary-button w-full"><VendorIcon name="add" className="h-4 w-4"/>Add new product</Link>
            <Link href="/vendor/stock" className="vendor-secondary-button w-full justify-start"><VendorIcon name="stock" className="h-4 w-4"/>Manage stock</Link>
            <Link href="/vendor/products" className="vendor-secondary-button w-full justify-start"><VendorIcon name="products" className="h-4 w-4"/>View my products</Link>
            <Link href="/vendor/orders" className="vendor-secondary-button w-full justify-start"><VendorIcon name="orders" className="h-4 w-4"/>View orders</Link>
          </div>
        </aside>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
        <section className="vendor-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="text-base font-semibold">Recent orders</h2><p className="mt-1 text-xs text-[var(--od-muted)]">Only your products, quantities and order progress are shown.</p></div>
            <Link href="/vendor/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--vendor-green)]">All orders <VendorIcon name="arrow" className="h-3.5 w-3.5" /></Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-5 rounded-xl bg-[#f4efe9] px-4 py-5 text-sm text-[var(--od-muted)]">No orders for your products yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-[var(--vendor-border)]">
              {recentOrders.map((order) => (
                <div key={order.orderId} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{order.orderReference}</p><span className="rounded-full bg-[#eef0ec] px-2.5 py-1 text-[10px] font-semibold text-[#536159]">{orderLabel(order.status)}</span></div>
                    <p className="mt-1 text-xs text-[var(--od-muted)]">{order.items.map((item) => `${item.productName} × ${item.quantity}`).join(" · ")}</p>
                    <p className="mt-1 text-[11px] text-[var(--od-muted)]">Placed {shortDate(order.placedAt)}</p>
                  </div>
                  <div className="text-left sm:text-right"><p className="text-xs text-[var(--od-muted)]">Your items</p><p className="mt-1 text-sm font-semibold">{order.units} unit{order.units === 1 ? "" : "s"} · {money(order.vendorLineTotalPaise)}</p></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="vendor-panel p-5 sm:p-6">
          <div className="flex items-center gap-2"><VendorIcon name="review" className="h-4 w-4 text-[var(--vendor-warm)]"/><h2 className="text-base font-semibold">Review updates</h2></div>
          {attention.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#edf4ed] p-4"><p className="text-sm font-medium text-[#365f40]">Nothing needs your attention</p><p className="mt-1 text-xs leading-5 text-[#6d7c70]">Any requested product changes will appear here.</p></div>
          ) : (
            <div className="mt-3 divide-y divide-[var(--vendor-border)]">
              {attention.map((product) => (
                <Link key={product.id} href={`/vendor/products/${product.id}`} className="block py-4 first:pt-2">
                  <div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold">{product.name}</p><VendorIcon name="arrow" className="h-4 w-4 shrink-0 text-[var(--od-muted)]" /></div>
                  <p className="mt-1 text-xs font-medium text-[#a1594e]">{vendorStatusLabel(product.vendor_submission_status)}</p>
                  {product.review_note ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--od-muted)]">{product.review_note}</p> : null}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
