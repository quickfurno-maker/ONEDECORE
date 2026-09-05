import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { listCommerceCategories, listCommerceProducts } from "@/features/commerce/server/commerce-queries";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { CategoriesWorkspace } from "@/features/commerce/components/CategoriesWorkspace";
import { CommerceDataUnavailable } from "@/features/commerce/components/CommerceDataUnavailable";
import { countProductsByCategory, isCommerceReadError } from "@/features/commerce/domain/commerce-read";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commerce categories | ONEDECORE Operations",
};

export default async function AdminCommerceCategoriesPage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?portal=admin&next=%2Fadmin%2Fcommerce%2Fcategories");
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

  return (
    <CategoriesWorkspace
      canManageCatalog={permissions.canManageCatalog}
      categories={categories}
      productCounts={countProductsByCategory(products)}
    />
  );
}
