import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { getCommerceSettings } from "@/features/commerce/server/commerce-queries";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { SettingsWorkspace } from "@/features/commerce/components/SettingsWorkspace";
import { CommerceDataUnavailable } from "@/features/commerce/components/CommerceDataUnavailable";
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

  return (
    <SettingsWorkspace
      canManageSettings={permissions.canManageSettings}
      taxSettings={settings.taxSettings}
      taxRates={settings.taxRates}
      shipping={settings.shipping}
      pincodes={settings.pincodes}
    />
  );
}
