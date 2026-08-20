import { notFound, redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { getCommerceProductDetailForWorkspace, listCommerceCategories } from "@/features/commerce/server/commerce-queries";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { ProductGeneralForm } from "@/features/commerce/components/ProductGeneralForm";
import { VariantForm } from "@/features/commerce/components/VariantForm";
import { MediaUploadForm } from "@/features/commerce/components/MediaUploadForm";
import { SpecsForm } from "@/features/commerce/components/SpecsForm";
import { RelatedForm } from "@/features/commerce/components/RelatedForm";
import { InventoryAdjustForm } from "@/features/commerce/components/InventoryAdjustForm";
import { PublishArchiveButtons } from "@/features/commerce/components/PublishArchiveButtons";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { ProductDetailShell, ProductSection } from "@/features/commerce/components/ProductDetailShell";
import { VariantSummaryTable } from "@/features/commerce/components/VariantSummaryTable";
import { ProductMediaGallery } from "@/features/commerce/components/ProductMediaGallery";
import { CommerceDataUnavailable } from "@/features/commerce/components/CommerceDataUnavailable";
import { isCommerceReadError } from "@/features/commerce/domain/commerce-read";

interface AdminCommerceProductDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

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
  let detail: Awaited<ReturnType<typeof getCommerceProductDetailForWorkspace>> | undefined;
  let categories: Awaited<ReturnType<typeof listCommerceCategories>> | undefined;
  try {
    const loaded = await Promise.all([getCommerceProductDetailForWorkspace(id), listCommerceCategories()]);
    detail = loaded[0];
    categories = loaded[1];
  } catch (error) {
    if (!isCommerceReadError(error)) {
      throw error;
    }
    return (
      <div className="mx-auto max-w-[1600px] space-y-6">
        <CommercePageHeader title="Product" subtitle="Catalogue command centre." />
        <StorefrontDisabledBanner />
        <CommerceAdminLinks />
        <CommerceDataUnavailable title="Product data unavailable" />
      </div>
    );
  }
  if (!detail || !categories) notFound();

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader
        title={detail.product.name}
        subtitle={`${detail.product.product_reference} · ${detail.product.status} · lock ${detail.product.lock_version}`}
      />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <ProductDetailShell
        detail={detail}
        railActions={
          permissions.canManageCatalog ? (
            <PublishArchiveButtons
              productId={detail.product.id}
              lockVersion={detail.product.lock_version}
              status={detail.product.status}
              publicationReady={detail.publicationReady}
            />
          ) : null
        }
      >
        <ProductSection id="overview" title="Overview">
          {permissions.canManageCatalog ? (
            <ProductGeneralForm detail={detail} categories={categories} taxRates={detail.taxRates} />
          ) : (
            <p className="text-sm text-[var(--od-text-2)]">{detail.product.slug}</p>
          )}
        </ProductSection>
        <ProductSection id="variants" title="Variants & Pricing">
          <VariantSummaryTable variants={detail.variants} inventory={detail.inventory} />
          {permissions.canManageCatalog ? (
            <>
              {detail.variants.map((variant) => (
                <VariantForm key={variant.id} productId={detail.product.id} variant={variant} />
              ))}
              <VariantForm productId={detail.product.id} />
            </>
          ) : null}
        </ProductSection>
        <ProductSection id="media" title="Media">
          <ProductMediaGallery media={detail.media} variants={detail.variants} />
          {permissions.canManageCatalog ? (
            <MediaUploadForm productId={detail.product.id} variants={detail.variants} media={detail.media} />
          ) : null}
        </ProductSection>
        <ProductSection id="inventory" title="Inventory">
          <ul className="space-y-1 text-sm text-[var(--od-text-2)]">
            {detail.inventory.map((row) => (
              <li key={row.variant_id}>
                on hand {row.stock_on_hand} · reserved {row.reserved_qty} · available {row.available_qty}
              </li>
            ))}
          </ul>
          {permissions.canManageInventory ? (
            <InventoryAdjustForm productId={detail.product.id} variants={detail.variants} inventory={detail.inventory} />
          ) : null}
        </ProductSection>
        <ProductSection id="specifications" title="Specifications">
          {permissions.canManageCatalog ? (
            <SpecsForm productId={detail.product.id} specifications={detail.specifications} />
          ) : (
            <ul className="text-sm text-[var(--od-text-2)]">
              {detail.specifications.map((spec) => (
                <li key={spec.id}>
                  {spec.specification_key}: {spec.specification_value}
                </li>
              ))}
            </ul>
          )}
        </ProductSection>
        <ProductSection id="seo" title="SEO">
          <p className="text-sm text-[var(--od-text-2)]">Title: {detail.product.seo_title || "—"}</p>
          <p className="text-sm text-[var(--od-text-2)]">Meta: {detail.product.seo_description || "—"}</p>
        </ProductSection>
        <ProductSection id="related" title="Related Products">
          {permissions.canManageCatalog ? (
            <RelatedForm productId={detail.product.id} relatedIds={detail.relatedProductIds} />
          ) : (
            <ul className="text-sm text-[var(--od-text-2)]">
              {detail.relatedProducts.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          )}
        </ProductSection>
      </ProductDetailShell>
    </div>
  );
}
