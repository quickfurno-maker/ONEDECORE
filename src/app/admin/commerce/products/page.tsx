import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { listCommerceProductWorkspace } from "@/features/commerce/server/commerce-queries";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { ProductsWorkspace } from "@/features/commerce/components/ProductsWorkspace";
import { CommerceDataUnavailable } from "@/features/commerce/components/CommerceDataUnavailable";
import { buildProductWorkspaceRows } from "@/features/commerce/domain/commerce-dashboard";
import { isCommerceReadError } from "@/features/commerce/domain/commerce-read";

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
  let workspace: Awaited<ReturnType<typeof listCommerceProductWorkspace>> | null = null;
  try {
    workspace = await listCommerceProductWorkspace({
      q,
      status,
      includeInventory: permissions.canRead,
    });
  } catch (error) {
    if (!isCommerceReadError(error)) {
      throw error;
    }
  }
  if (!workspace) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-6">
        <CommercePageHeader title="Products" subtitle="Catalogue workspace. Public /shop is off." />
        <StorefrontDisabledBanner />
        <CommerceAdminLinks />
        <CommerceDataUnavailable title="Product catalogue unavailable" />
      </div>
    );
  }
  const rows = buildProductWorkspaceRows({
    products: workspace.products,
    categories: workspace.categories,
    variants: workspace.variants,
    media: workspace.media,
    inventory: workspace.inventoryStatus === "ok" ? workspace.inventory : null,
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
    <ProductsWorkspace
      canManageCatalog={permissions.canManageCatalog}
      categories={workspace.categories}
      rows={rows}
      filters={{ q, status, category, featured, mode, media }}
      catalogueEmpty={workspace.products.length === 0}
    />
  );
}
