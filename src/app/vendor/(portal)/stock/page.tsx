import { listMyVendorProducts } from "@/features/commerce/vendor/vendor-queries";
import { VendorStockWorkspace } from "@/features/commerce/vendor/components/VendorStockWorkspace";

export default async function VendorStockPage() {
  const products = await listMyVendorProducts();
  const readyStock = products.filter((product) => product.availabilityMode === "ready_stock");
  const availableUnits = readyStock.reduce((sum, product) => sum + product.availableQty, 0);
  const unavailable = products.filter((product) => !product.vendor_sales_enabled || product.vendor_stock_status === "out_of_stock").length;
  return (
    <div className="space-y-5 sm:space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--vendor-green)]">Daily inventory</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">Stock & Availability</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--od-text-2)]">Keep quantities accurate and pause sales when an item should not accept new orders. OneDecore still controls catalogue publication.</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="vendor-panel-flat p-4"><p className="text-xs text-[var(--od-muted)]">Products</p><p className="mt-1 text-2xl font-semibold">{products.length}</p></div>
        <div className="vendor-panel-flat p-4"><p className="text-xs text-[var(--od-muted)]">Available units</p><p className="mt-1 text-2xl font-semibold text-[var(--vendor-green)]">{availableUnits}</p></div>
        <div className="vendor-panel-flat p-4"><p className="text-xs text-[var(--od-muted)]">Unavailable / paused</p><p className="mt-1 text-2xl font-semibold text-[#ad6351]">{unavailable}</p></div>
      </section>
      <VendorStockWorkspace products={products} />
    </div>
  );
}
