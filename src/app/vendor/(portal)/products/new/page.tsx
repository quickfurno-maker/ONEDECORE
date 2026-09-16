import Link from "next/link";
import { VendorProductForm } from "@/features/commerce/vendor/components/VendorProductForm";

export default function NewVendorProductPage() {
  return (
    <div className="space-y-5">
      <div><Link href="/vendor/products" className="text-xs text-[var(--od-muted)] hover:text-[var(--od-gold)]">← My Products</Link><h1 className="mt-3 text-2xl font-semibold">Add Product</h1><p className="mt-1 text-sm text-[var(--od-muted)]">Create the basic product first, then upload photos and submit it for review.</p></div>
      <div className="max-w-3xl"><VendorProductForm /></div>
    </div>
  );
}
