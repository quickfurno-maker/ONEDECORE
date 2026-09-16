import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireCommerceVendor } from "@/features/commerce/vendor/vendor-auth";
import { VendorNav } from "@/features/commerce/vendor/components/VendorNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function VendorPortalLayout({ children }: { children: ReactNode }) {
  const vendor = await requireCommerceVendor();
  return (
    <div className="min-h-screen bg-[var(--od-bg)] text-[var(--od-text)]">
      <header className="border-b border-[var(--od-border)] bg-[var(--od-surface)]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <div className="font-serif text-xl font-semibold">ONEDECORE</div>
            <p className="text-xs text-[var(--od-muted)]">Vendor Portal</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{vendor.displayName}</p>
            <p className="text-xs text-[var(--od-muted)]">{vendor.vendorCode}</p>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-3 lg:sticky lg:top-4 lg:h-fit">
          <VendorNav />
          <form method="post" action="/vendor/signout" className="mt-4 border-t border-[var(--od-border)] pt-3">
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-[var(--od-muted)] transition hover:bg-[var(--od-hover)] hover:text-[var(--od-text)]"
            >
              Sign out
            </button>
          </form>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
