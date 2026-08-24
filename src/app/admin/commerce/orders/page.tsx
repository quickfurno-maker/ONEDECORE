import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommerceDataUnavailable } from "@/features/commerce/components/CommerceDataUnavailable";
import { CommerceOrdersListView } from "@/features/commerce/components/CommerceOrdersListView";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { listCommerceOrders } from "@/features/commerce/server/order-admin-queries.ts";
import { isCommerceReadError } from "@/features/commerce/domain/commerce-read";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commerce orders | ONEDECORE Operations",
};

interface AdminCommerceOrdersPageProps {
  readonly searchParams: Promise<{ status?: string; q?: string }>;
}

const STATUSES = ["all", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;

export default async function AdminCommerceOrdersPage({ searchParams }: AdminCommerceOrdersPageProps) {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcommerce%2Forders");
  }
  const permissions = await probeCommercePermissions();
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }
  const params = await searchParams;
  const status = params.status ?? "all";
  const q = params.q ?? "";
  let orders: Awaited<ReturnType<typeof listCommerceOrders>> | null = null;
  try {
    orders = await listCommerceOrders({
      status: STATUSES.includes(status as (typeof STATUSES)[number]) ? status : "all",
      search: q,
    });
  } catch (error) {
    if (!isCommerceReadError(error)) {
      throw error;
    }
  }
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader
        title="Orders"
        subtitle="Guest COD orders. Fulfilment and cancellation via canonical RPCs only."
      />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      {!orders ? (
        <CommerceDataUnavailable title="Orders unavailable" />
      ) : (
        <>
          <form method="get" className="flex flex-wrap gap-3 text-sm">
            <label>
              Status
              <select name="status" defaultValue={status} className="ml-2 rounded border px-2 py-1">
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search
              <input
                name="q"
                defaultValue={q}
                placeholder="Reference or customer"
                className="ml-2 rounded border px-2 py-1"
                maxLength={80}
              />
            </label>
            <button type="submit" className="rounded border px-3 py-1">
              Filter
            </button>
            {q || status !== "all" ? (
              <Link href="/admin/commerce/orders" className="self-center text-[var(--od-muted)]">
                Clear
              </Link>
            ) : null}
          </form>
          <CommerceOrdersListView orders={orders} canManageOrders={permissions.canManageOrders} />
        </>
      )}
    </div>
  );
}
