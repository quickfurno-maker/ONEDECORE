import Link from "next/link";
import { listMyVendorProducts } from "@/features/commerce/vendor/vendor-queries";
import { vendorStatusLabel } from "@/features/commerce/vendor/vendor-domain";

function money(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

export default async function VendorProductsPage() {
  const rows = await listMyVendorProducts();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">My Products</h1><p className="mt-1 text-sm text-[var(--od-muted)]">Draft, submit and follow OneDecore review.</p></div>
        <Link href="/vendor/products/new" className="inline-flex min-h-11 items-center rounded-lg bg-[var(--od-gold)] px-4 text-sm font-semibold text-black">Add product</Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)]">
        {rows.length === 0 ? <p className="p-8 text-sm text-[var(--od-muted)]">No products have been added.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[var(--od-elevated)] text-xs text-[var(--od-muted)]"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Photos</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-[var(--od-border)]">{rows.map((row) => <tr key={row.id} className="hover:bg-[var(--od-hover)]"><td className="px-4 py-3"><Link href={`/vendor/products/${row.id}`} className="font-medium hover:text-[var(--od-gold)]">{row.name}</Link><p className="text-xs text-[var(--od-muted)]">{row.product_reference} · {row.sku}</p></td><td className="px-4 py-3">{money(row.sellingPricePaise)}</td><td className="px-4 py-3 capitalize">{row.vendor_stock_status.replaceAll("_", " ")}</td><td className="px-4 py-3">{row.imageCount}</td><td className="px-4 py-3">{vendorStatusLabel(row.vendor_submission_status)}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </div>
  );
}
