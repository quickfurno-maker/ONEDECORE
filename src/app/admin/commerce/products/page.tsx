import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { listCommerceCategories, listCommerceProducts } from "@/features/commerce/server/commerce-queries";
import { ProductCreateForm } from "@/features/commerce/components/ProductCreateForm";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";

export const metadata = {
  title: "Commerce products | OneDecore Admin",
};

interface AdminCommerceProductsPageProps {
  readonly searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function AdminCommerceProductsPage({ searchParams }: AdminCommerceProductsPageProps) {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcommerce%2Fproducts");
  }
  const permissions = await probeCommercePermissions();
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }
  const params = await searchParams;
  const q = params.q ?? "";
  const status = params.status ?? "all";
  const [products, categories] = await Promise.all([
    listCommerceProducts({ q, status }),
    listCommerceCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Products</h1>
        <p className="mt-1 text-xs text-neutral-400">Search and filter catalogue drafts. Public /shop is off.</p>
      </div>
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <form className="flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, slug, reference"
          className="min-h-11 min-w-56 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
        <select
          name="status"
          defaultValue={status}
          className="min-h-11 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <option value="all">All statuses</option>
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-100"
        >
          Filter
        </button>
      </form>
      {permissions.canManageCatalog ? <ProductCreateForm categories={categories} /> : null}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-neutral-800 bg-neutral-950 text-[10px] uppercase tracking-wider text-neutral-400">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Name</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900 text-neutral-200">
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-neutral-500">
                  No products yet.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td className="p-3 font-medium">{product.product_reference}</td>
                  <td className="p-3">{product.name}</td>
                  <td className="p-3">{product.slug}</td>
                  <td className="p-3">{product.status}</td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/commerce/products/${product.id}`} className="text-amber-300 hover:text-amber-200">
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
