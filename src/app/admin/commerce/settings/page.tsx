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

export const metadata = {
  title: "Commerce settings | OneDecore Admin",
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
  const settings = await getCommerceSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Commerce settings</h1>
        <p className="mt-1 text-xs text-neutral-400">Tax, shipping, and pincodes. No statutory GST seed.</p>
      </div>
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      {permissions.canManageSettings ? (
        <>
          <TaxSettingsForm settings={settings.taxSettings} />
          <ShippingSettingsForm settings={settings.shipping} />
          <TaxRateForm />
          {settings.taxRates.map((rate) => (
            <TaxRateForm key={rate.id} rate={rate} />
          ))}
          <PincodeForm />
          {settings.pincodes.map((row) => (
            <PincodeForm key={row.pincode} pincode={row} />
          ))}
        </>
      ) : (
        <div className="space-y-4 text-sm text-neutral-300">
          <p>Tax rates: {settings.taxRates.length}</p>
          <ul className="text-xs">
            {settings.taxRates.map((rate) => (
              <li key={rate.id}>
                {rate.code} · {rate.rate_basis_points} bps · {rate.is_active ? "active" : "inactive"}
              </li>
            ))}
          </ul>
          <p>Pincodes: {settings.pincodes.length}</p>
        </div>
      )}
    </div>
  );
}
