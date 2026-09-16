import Link from "next/link";
import { notFound } from "next/navigation";
import { buildCommercePublicUrl } from "@/features/commerce/public/public-url";
import { getMyVendorProduct } from "@/features/commerce/vendor/vendor-queries";
import { VendorProductForm } from "@/features/commerce/vendor/components/VendorProductForm";
import { VendorMediaManager } from "@/features/commerce/vendor/components/VendorMediaManager";
import { VendorSubmissionPanel } from "@/features/commerce/vendor/components/VendorSubmissionPanel";

export default async function VendorProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getMyVendorProduct(id);
  if (!detail) notFound();
  const editable = ["draft", "changes_requested"].includes(detail.product.vendor_submission_status);
  const media = detail.media.map((item) => ({ id: item.id, url: buildCommercePublicUrl(item.public_path), isPrimary: item.is_primary }));
  const productForm = {
    id: detail.product.id,
    name: detail.product.name,
    description: detail.product.full_description,
    sku: detail.variant.sku,
    pricePaise: detail.variant.selling_price_paise,
    stockStatus: detail.product.vendor_stock_status,
    lockVersion: detail.product.lock_version,
  };
  return (
    <div className="space-y-5">
      <div><Link href="/vendor/products" className="text-xs text-[var(--od-muted)] hover:text-[var(--od-gold)]">← My Products</Link><h1 className="mt-3 text-2xl font-semibold">{detail.product.name}</h1><p className="mt-1 text-sm text-[var(--od-muted)]">{detail.product.product_reference}</p></div>
      <VendorSubmissionPanel productId={detail.product.id} lockVersion={detail.product.lock_version} status={detail.product.vendor_submission_status} reviewNote={detail.product.review_note} imageCount={detail.media.length} />
      {editable ? <VendorProductForm product={productForm} /> : (
        <section className="rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-5 text-sm">
          <h2 className="font-semibold">Submitted product details</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-[var(--od-muted)]">SKU</dt><dd>{detail.variant.sku}</dd></div><div><dt className="text-xs text-[var(--od-muted)]">Selling price</dt><dd>₹{(detail.variant.selling_price_paise / 100).toLocaleString("en-IN")}</dd></div><div><dt className="text-xs text-[var(--od-muted)]">Stock mode</dt><dd className="capitalize">{detail.product.vendor_stock_status.replaceAll("_", " ")}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-[var(--od-muted)]">Description</dt><dd className="mt-1 whitespace-pre-wrap text-[var(--od-text-2)]">{detail.product.full_description}</dd></div></dl>
        </section>
      )}
      <VendorMediaManager productId={detail.product.id} media={media} editable={editable} />
    </div>
  );
}
