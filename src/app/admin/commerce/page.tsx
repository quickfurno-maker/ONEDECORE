import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { loadCommerceCatalogueGraph } from "@/features/commerce/server/commerce-queries";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommerceDashboardView } from "@/features/commerce/components/CommerceDashboardView";
import { CommerceDataUnavailable } from "@/features/commerce/components/CommerceDataUnavailable";
import {
  CommerceGhostButton,
  CommerceGoldButton,
  CommercePageHeader,
} from "@/features/commerce/components/CommercePageHeader";
import { buildCommerceDashboardSnapshot } from "@/features/commerce/domain/commerce-dashboard";
import { isCommerceReadError } from "@/features/commerce/domain/commerce-read";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commerce | ONEDECORE Operations",
  description: "Catalogue, inventory and storefront readiness.",
};

export default async function AdminCommercePage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcommerce");
  }
  const permissions = await probeCommercePermissions();
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }

  let graph: Awaited<ReturnType<typeof loadCommerceCatalogueGraph>> | null = null;
  let loadFailed = false;
  try {
    graph = await loadCommerceCatalogueGraph({ includeInventory: permissions.canRead });
  } catch (error) {
    if (!isCommerceReadError(error)) {
      throw error;
    }
    loadFailed = true;
  }

  const snapshot = graph
    ? buildCommerceDashboardSnapshot({
        products: graph.products,
        categories: graph.categories,
        variants: graph.variants,
        media: graph.media,
        taxRates: graph.taxRates,
        taxRequiredForPublish: graph.taxSettings?.tax_required_for_publish ?? true,
        gstInclusiveDisplay: graph.taxSettings?.gst_inclusive_display ?? true,
        shippingPresent: graph.shipping != null,
        pincodes: graph.pincodes,
        inventory: graph.inventory,
        inventoryStatus: graph.inventoryStatus,
      })
    : null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 lg:space-y-7">
      <CommercePageHeader
        title="Commerce"
        subtitle="Catalogue, inventory and storefront readiness."
        actions={
          <>
            {permissions.canManageCatalog ? (
              <CommerceGoldButton href="/admin/commerce/products">+ Add Product</CommerceGoldButton>
            ) : null}
            {permissions.canManageCatalog ? (
              <CommerceGhostButton href="/admin/commerce/categories">Manage Categories</CommerceGhostButton>
            ) : null}
          </>
        }
      />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      {loadFailed || !snapshot ? (
        <CommerceDataUnavailable />
      ) : (
        <CommerceDashboardView
          snapshot={snapshot}
          canManageCatalog={permissions.canManageCatalog}
          canManageInventory={permissions.canManageInventory}
          canManageSettings={permissions.canManageSettings}
        />
      )}
    </div>
  );
}
