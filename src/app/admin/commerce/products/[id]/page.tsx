import { notFound, redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { getCommerceProductDetail, listCommerceCategories } from "@/features/commerce/server/commerce-queries";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { ProductGeneralForm } from "@/features/commerce/components/ProductGeneralForm";
import { VariantForm } from "@/features/commerce/components/VariantForm";
import { MediaUploadForm } from "@/features/commerce/components/MediaUploadForm";
import { SpecsForm } from "@/features/commerce/components/SpecsForm";
import { RelatedForm } from "@/features/commerce/components/RelatedForm";
import { InventoryAdjustForm } from "@/features/commerce/components/InventoryAdjustForm";
import { PublishArchiveButtons } from "@/features/commerce/components/PublishArchiveButtons";

interface AdminCommerceProductDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function AdminCommerceProductDetailPage({ params }: AdminCommerceProductDetailPageProps) {
  const { id } = await params;
  const session = await getStaffClaims();
  if (!session) {
    redirect(`/auth/login?next=${encodeURIComponent(`/admin/commerce/products/${id}`)}`);
  }
  const permissions = await probeCommercePermissions();
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }
  const [detail, categories] = await Promise.all([getCommerceProductDetail(id), listCommerceCategories()]);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">{detail.product.name}</h1>
        <p className="mt-1 text-xs text-neutral-400">
          {detail.product.product_reference} · {detail.product.status} · lock {detail.product.lock_version}
        </p>
      </div>
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">General</h2>
        {permissions.canManageCatalog ? (
          <ProductGeneralForm detail={detail} categories={categories} taxRates={detail.taxRates} />
        ) : (
          <p className="text-sm text-neutral-300">{detail.product.slug}</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Variants & Price</h2>
        <div className="space-y-2 text-xs text-neutral-300">
          {detail.variants.map((variant) => (
            <p key={variant.id}>
              {variant.sku} · {variant.selling_price_paise} paise · {variant.status}
            </p>
          ))}
        </div>
        {permissions.canManageCatalog ? (
          <>
            {detail.variants.map((variant) => (
              <VariantForm key={variant.id} productId={detail.product.id} variant={variant} />
            ))}
            <VariantForm productId={detail.product.id} />
          </>
        ) : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Media</h2>
        {permissions.canManageCatalog ? (
          <MediaUploadForm productId={detail.product.id} variants={detail.variants} media={detail.media} />
        ) : (
          <ul className="text-xs text-neutral-300">
            {detail.media.map((item) => (
              <li key={item.id}>{item.public_path}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Specifications</h2>
        {permissions.canManageCatalog ? (
          <SpecsForm productId={detail.product.id} specifications={detail.specifications} />
        ) : (
          <ul className="text-xs text-neutral-300">
            {detail.specifications.map((spec) => (
              <li key={spec.id}>
                {spec.specification_key}: {spec.specification_value}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Related</h2>
        {permissions.canManageCatalog ? (
          <RelatedForm productId={detail.product.id} relatedIds={detail.relatedProductIds} />
        ) : (
          <ul className="text-xs text-neutral-300">
            {detail.relatedProducts.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Inventory</h2>
        <ul className="text-xs text-neutral-300">
          {detail.inventory.map((row) => (
            <li key={row.variant_id}>
              on hand {row.stock_on_hand} · reserved {row.reserved_qty} · available {row.available_qty}
            </li>
          ))}
        </ul>
        {permissions.canManageInventory ? (
          <InventoryAdjustForm productId={detail.product.id} variants={detail.variants} inventory={detail.inventory} />
        ) : null}
      </section>
      {permissions.canManageCatalog ? (
        <PublishArchiveButtons
          productId={detail.product.id}
          lockVersion={detail.product.lock_version}
          status={detail.product.status}
          publicationReady={detail.publicationReady}
        />
      ) : null}
    </div>
  );
}
