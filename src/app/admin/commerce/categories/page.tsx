import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { listCommerceCategories, listCommerceProducts } from "@/features/commerce/server/commerce-queries";
import { CategoryForm } from "@/features/commerce/components/CategoryForm";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { CategoryTree } from "@/features/commerce/components/CategoryTree";
import { CommerceDataUnavailable } from "@/features/commerce/components/CommerceDataUnavailable";
import { countProductsByCategory, isCommerceReadError } from "@/features/commerce/domain/commerce-read";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commerce categories | ONEDECORE Operations",
};

export default async function AdminCommerceCategoriesPage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcommerce%2Fcategories");
  }
  const permissions = await probeCommercePermissions();
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }

  let categories: Awaited<ReturnType<typeof listCommerceCategories>> | null = null;
  let products: Awaited<ReturnType<typeof listCommerceProducts>> | null = null;
  try {
    const [categoryRows, productRows] = await Promise.all([listCommerceCategories(), listCommerceProducts()]);
    categories = categoryRows;
    products = productRows;
  } catch (error) {
    if (!isCommerceReadError(error)) {
      throw error;
    }
  }

  if (!categories || !products) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-6">
        <CommercePageHeader title="Categories" subtitle="Root categories and one subcategory depth." />
        <StorefrontDisabledBanner />
        <CommerceAdminLinks />
        <CommerceDataUnavailable title="Commerce categories unavailable" />
      </div>
    );
  }

  const roots = categories.filter((row) => row.parent_category_id === null);
  const productCounts = countProductsByCategory(products);
  const editors: Record<string, ReactNode> = {};
  for (const category of categories) {
    editors[category.id] = permissions.canManageCatalog ? (
      <CategoryForm category={category} rootCategories={roots} />
    ) : (
      <p className="mt-2 text-xs text-[var(--od-muted)]">
        {category.category_reference} · {category.slug}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader title="Categories" subtitle="Root categories and one subcategory depth." />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      {permissions.canManageCatalog ? <CategoryForm rootCategories={roots} /> : null}
      <CategoryTree categories={categories} productCounts={productCounts} editors={editors} />
    </div>
  );
}
