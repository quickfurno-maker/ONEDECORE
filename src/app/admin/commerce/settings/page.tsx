import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { getCommerceSettings } from "@/features/commerce/server/commerce-queries";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { TaxRateForm } from "@/features/commerce/components/TaxRateForm";
import { TaxSettingsForm } from "@/features/commerce/components/TaxSettingsForm";
import { ShippingSettingsForm } from "@/features/commerce/components/ShippingSettingsForm";
import { PincodeForm } from "@/features/commerce/components/PincodeForm";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { CommerceDataUnavailable } from "@/features/commerce/components/CommerceDataUnavailable";
import { DashboardPanel } from "@/features/admin-ops/components/DashboardPanel.tsx";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts.ts";
import { isCommerceReadError } from "@/features/commerce/domain/commerce-read";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commerce settings | ONEDECORE Operations",
};

export default async function AdminCommerceSettingsPage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcommerce%2Fsettings");
  }
  const permissions = await probeCommercePermissions();
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }
  let settings: Awaited<ReturnType<typeof getCommerceSettings>> | null = null;
  try {
    settings = await getCommerceSettings();
  } catch (error) {
    if (!isCommerceReadError(error)) {
      throw error;
    }
  }
  if (!settings) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-6">
        <CommercePageHeader title="Commerce settings" subtitle="Tax, shipping, COD, and pincode serviceability." />
        <StorefrontDisabledBanner />
        <CommerceAdminLinks />
        <CommerceDataUnavailable title="Commerce settings unavailable" />
      </div>
    );
  }
  const serviceable = settings.pincodes.filter((row) => row.serviceable).length;
  const groups = new Map<string, number>();
  for (const row of settings.pincodes.filter((item) => item.serviceable)) {
    const label = row.zone_code?.trim() || "Ungrouped";
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader title="Commerce settings" subtitle="Tax, shipping, COD, and pincode serviceability." />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Tax">
          <p className="mb-3 text-sm text-[var(--od-text-2)]">GST-inclusive display is locked true.</p>
          {permissions.canManageSettings ? (
            <>
              <TaxSettingsForm settings={settings.taxSettings} />
              <div className="mt-4 space-y-3">
                <TaxRateForm />
                {settings.taxRates.map((rate) => (
                  <TaxRateForm key={rate.id} rate={rate} />
                ))}
              </div>
            </>
          ) : (
            <ul className="space-y-1 text-sm text-[var(--od-text-2)]">
              {settings.taxRates.map((rate) => (
                <li key={rate.id}>
                  {rate.code} · {rate.rate_basis_points} bps · {rate.is_active ? "active" : "inactive"}
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
        <DashboardPanel title="Shipping / COD">
          {settings.shipping ? (
            <ul className="mb-4 space-y-1 text-sm text-[var(--od-text-2)]">
              <li>Default charge {formatInrFromPaise(settings.shipping.default_shipping_charge_paise)}</li>
              <li>
                Free shipping threshold{" "}
                {settings.shipping.free_shipping_threshold_paise == null
                  ? "—"
                  : formatInrFromPaise(settings.shipping.free_shipping_threshold_paise)}
              </li>
              <li>COD {settings.shipping.cod_enabled_global ? "enabled" : "disabled"}</li>
            </ul>
          ) : (
            <p className="mb-4 text-sm text-[var(--od-muted)]">Shipping settings are not configured.</p>
          )}
          {permissions.canManageSettings ? <ShippingSettingsForm settings={settings.shipping} /> : null}
        </DashboardPanel>
        <DashboardPanel title="Pincodes">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--od-muted)]">Serviceable</p>
              <p className="text-xl font-semibold">{serviceable}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--od-muted)]">Non-serviceable</p>
              <p className="text-xl font-semibold">{settings.pincodes.length - serviceable}</p>
            </div>
          </div>
          <p className="mb-3 text-xs text-[var(--od-muted)]">
            Display groups use zone codes. Serviceability is pincode-level.
          </p>
          <ul className="mb-4 space-y-1 text-xs text-[var(--od-text-2)]">
            {[...groups.entries()].map(([label, count]) => (
              <li key={label}>
                {label}: {count}
              </li>
            ))}
          </ul>
          {permissions.canManageSettings ? (
            <>
              <PincodeForm />
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {settings.pincodes.map((row) => (
                  <PincodeForm key={row.pincode} pincode={row} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--od-text-2)]">Pincodes: {settings.pincodes.length}</p>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
