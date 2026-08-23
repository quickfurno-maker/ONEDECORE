import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommerceDataUnavailable } from "@/features/commerce/components/CommerceDataUnavailable";
import { CommerceOrderDetailPanel } from "@/features/commerce/components/CommerceOrderDetailPanel";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { getCommerceOrderDetail } from "@/features/commerce/server/order-admin-queries.ts";
import { isCommerceReadError } from "@/features/commerce/domain/commerce-read";

export const dynamic = "force-dynamic";

interface AdminCommerceOrderDetailPageProps {
  readonly params: Promise<{ orderId: string }>;
}

export async function generateMetadata() {
  return { title: "Order detail | ONEDECORE Operations" };
}

export default async function AdminCommerceOrderDetailPage({
  params,
}: AdminCommerceOrderDetailPageProps) {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcommerce%2Forders");
  }
  const permissions = await probeCommercePermissions();
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }
  const { orderId } = await params;
  let order: Awaited<ReturnType<typeof getCommerceOrderDetail>> | null = null;
  try {
    order = await getCommerceOrderDetail(orderId);
  } catch (error) {
    if (!isCommerceReadError(error)) {
      throw error;
    }
  }
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader
        title="Order detail"
        subtitle="Immutable snapshots and fulfilment transitions."
      />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <p>
        <Link href="/admin/commerce/orders" className="text-sm text-[var(--od-gold)]">
          ← Back to orders
        </Link>
      </p>
      {!order ? (
        <CommerceDataUnavailable title="Order unavailable or not found" />
      ) : (
        <CommerceOrderDetailPanel order={order} canManageOrders={permissions.canManageOrders} />
      )}
    </div>
  );
}
