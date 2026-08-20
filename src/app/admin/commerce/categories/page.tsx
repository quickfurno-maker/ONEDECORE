import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { listCommerceCategories, listRootCommerceCategories } from "@/features/commerce/server/commerce-queries";
import { CategoryForm } from "@/features/commerce/components/CategoryForm";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";

export const metadata = {
  title: "Commerce categories | OneDecore Admin",
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
  const [categories, roots] = await Promise.all([listCommerceCategories(), listRootCommerceCategories()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Categories</h1>
        <p className="mt-1 text-xs text-neutral-400">Parents may only be root categories.</p>
      </div>
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      {permissions.canManageCatalog ? <CategoryForm rootCategories={roots} /> : null}
      <div className="space-y-4">
        {categories.length === 0 ? (
          <p className="text-sm text-neutral-500">No categories yet.</p>
        ) : (
          categories.map((category) =>
            permissions.canManageCatalog ? (
              <CategoryForm key={category.id} category={category} rootCategories={roots} />
            ) : (
              <div key={category.id} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-200">
                <p className="font-medium">{category.name}</p>
                <p className="text-xs text-neutral-400">
                  {category.category_reference} · {category.slug} · {category.status}
                </p>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
