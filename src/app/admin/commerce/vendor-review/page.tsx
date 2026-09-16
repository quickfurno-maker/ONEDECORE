import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { listVendorReviewQueue } from "@/features/commerce/vendor/vendor-admin-queries";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";

export const dynamic = "force-dynamic";

export default async function CommerceVendorReviewPage() {
  const session = await getStaffClaims();
  if (!session) redirect("/auth/login?portal=admin&next=%2Fadmin%2Fcommerce%2Fvendor-review");
  const permissions = await probeCommercePermissions();
  if (!permissions.canManageCatalog) redirect("/auth/forbidden");
  const queue = await listVendorReviewQueue();
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader title="Vendor Review" subtitle="Review submitted vendor products before catalogue approval." />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <section className="overflow-hidden rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)]">
        {queue.length === 0 ? (
          <p className="p-8 text-sm text-[var(--od-muted)]">No vendor products are waiting for review.</p>
        ) : (
          <div className="divide-y divide-[var(--od-border)]">
            {queue.map((item) => (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <h2 className="text-sm font-semibold">{item.name}</h2>
                  <p className="mt-1 text-xs text-[var(--od-muted)]">
                    {item.productReference} · {item.vendorName} · {item.vendorCode}
                  </p>
                  <p className="mt-1 text-xs text-[var(--od-text-2)]">
                    {item.categoryId ? "Category assigned" : "Category required before approval"}
                  </p>
                </div>
                <Link
                  href={`/admin/commerce/products/${item.id}`}
                  className="inline-flex min-h-10 items-center rounded-lg border border-[var(--od-border)] px-4 text-sm font-medium hover:bg-[var(--od-hover)]"
                >
                  Review product
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
