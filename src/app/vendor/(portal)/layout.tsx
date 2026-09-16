import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireCommerceVendor } from "@/features/commerce/vendor/vendor-auth";
import { VendorNav } from "@/features/commerce/vendor/components/VendorNav";
import { VendorIcon } from "@/features/commerce/vendor/components/VendorIcon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "V";
}

export default async function VendorPortalLayout({ children }: { children: ReactNode }) {
  const vendor = await requireCommerceVendor();
  return (
    <div className="od-vendor min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="border-b border-[var(--vendor-border)] bg-[rgba(255,253,249,.94)] backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex min-h-full flex-col px-4 py-4 lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-4 lg:block">
            <div>
              <div className="font-serif text-[27px] font-semibold tracking-[-0.03em] text-[#202521]">OneDecore</div>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-[var(--od-muted)]">Vendor workspace</p>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#456b50] text-xs font-semibold text-white">{initials(vendor.displayName)}</span>
              <div className="max-w-28 text-right"><p className="truncate text-xs font-semibold">{vendor.displayName}</p><p className="text-[10px] text-[var(--od-muted)]">{vendor.vendorCode}</p></div>
              <form method="post" action="/vendor/signout">
                <button type="submit" aria-label="Sign out" className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--vendor-border)] bg-white text-[var(--od-text-2)]">
                  <VendorIcon name="signout" className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          <div className="mt-4 lg:mt-9"><VendorNav /></div>

          <div className="mt-auto hidden pt-8 lg:block">
            <div className="vendor-panel-flat p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e8dfd5] text-xs font-semibold text-[#354039]">{initials(vendor.displayName)}</span>
                <div className="min-w-0"><p className="truncate text-xs font-semibold">{vendor.displayName}</p><p className="mt-0.5 text-[10px] text-[var(--od-muted)]">{vendor.vendorCode}</p></div>
              </div>
              <form method="post" action="/vendor/signout" className="mt-4 border-t border-[var(--vendor-border)] pt-3">
                <button type="submit" className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-xs font-medium text-[var(--od-text-2)] transition hover:bg-[#f3ede6] hover:text-[var(--od-text)]">
                  <VendorIcon name="signout" className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8 xl:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
