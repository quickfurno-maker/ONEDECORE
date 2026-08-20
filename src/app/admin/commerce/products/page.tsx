import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { listCommerceProductWorkspace } from "@/features/commerce/server/commerce-queries";
import { ProductCreateForm } from "@/features/commerce/components/ProductCreateForm";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { ProductWorkspaceTable } from "@/features/commerce/components/ProductWorkspaceTable";
import { buildProductWorkspaceRows } from "@/features/commerce/domain/commerce-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commerce products | ONEDECORE Operations",
};

interface AdminCommerceProductsPageProps {
  readonly searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    featured?: string;
    mode?: string;
    media?: string;
  }>;
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
  const category = params.category ?? "all";
  const featured = params.featured ?? "all";
  const mode = params.mode ?? "all";
  const media = params.media ?? "all";
  const workspace = await listCommerceProductWorkspace({
    q,
    status,
    includeInventory: permissions.canRead,
  });
  const rows = buildProductWorkspaceRows({
    products: workspace.products,
    categories: workspace.categories,
    variants: workspace.variants,
    media: workspace.media,
    inventory: permissions.canRead ? workspace.inventory : null,
  }).filter((row) => {
    if (category !== "all") {
      const match = workspace.products.find((product) => product.id === row.id);
      if (match?.category_id !== category) return false;
    }
    if (featured === "true" && !row.featured) return false;
    if (featured === "false" && row.featured) return false;
    if (mode === "ready_stock" && row.availabilityMode !== "ready_stock" && row.availabilityMode !== "mixed") {
      return false;
    }
    if (mode === "made_to_order" && row.availabilityMode !== "made_to_order" && row.availabilityMode !== "mixed") {
      return false;
    }
    if (media === "ready" && !row.hasPublicPrimary) return false;
    if (media === "missing" && row.hasPublicPrimary) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader title="Products" subtitle="Catalogue workspace. Public /shop is off." />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      {permissions.canManageCatalog ? <ProductCreateForm categories={workspace.categories} /> : null}
      <ProductWorkspaceTable
        rows={rows}
        categories={workspace.categories}
        filters={{ q, status, category, featured, mode, media }}
      />
    </div>
  );
}
