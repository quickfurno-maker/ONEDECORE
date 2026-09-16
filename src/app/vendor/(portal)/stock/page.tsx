import { listMyVendorProducts } from "@/features/commerce/vendor/vendor-queries";
import { VendorStockWorkspace } from "@/features/commerce/vendor/components/VendorStockWorkspace";

export default async function VendorStockPage() {
  const products = await listMyVendorProducts();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Stock & Availability</h1>
        <p className="mt-1 text-sm text-[var(--od-muted)]">
          Update ready-stock quantity or pause and resume sales. Catalogue publication remains controlled by OneDecore.
        </p>
      </div>
      <VendorStockWorkspace products={products} />
    </div>
  );
}
