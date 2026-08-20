import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import {
  listCommerceCategories,
  listCommerceProducts,
  listRootCommerceCategories,
} from "@/features/commerce/server/commerce-queries";
import { CategoryForm } from "@/features/commerce/components/CategoryForm";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { CategoryTree } from "@/features/commerce/components/CategoryTree";

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
  const [categories, roots, products] = await Promise.all([
    listCommerceCategories(),
    listRootCommerceCategories(),
    listCommerceProducts(),
  ]);
  const productCounts: Record<string, number> = {};
  for (const product of products) {
    productCounts[product.category_id] = (productCounts[product.category_id] ?? 0) + 1;
  }
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
