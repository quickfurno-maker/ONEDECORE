import { redirect } from "next/navigation";
import { requireStaffPermission } from "@/server/auth";
import { isCurrentUserSuperAdmin } from "@/features/quotations/server/quotation-permissions";
import { QuotationCommercialSettingsAdmin } from "@/features/quotations/components/QuotationCommercialSettingsAdmin";
import {
  adminCreateTaxProfileAction,
  adminUpdateTaxProfileAction,
  setQuotationMaxDiscountAction,
} from "@/features/quotations/server/quotation-finalization-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quotation Commercial Settings | ONEDECORE",
  description: "Super Admin tax profile and max-discount governance.",
};

export default async function QuotationCommercialSettingsPage() {
  await requireStaffPermission("admin.access", "/admin/quotations/settings");
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) {
    redirect("/auth/forbidden");
  }

  const supabase = await createClient();
  const [{ data: settingsRows }, { data: taxProfiles }] = await Promise.all([
    supabase
      .from("quotation_commercial_settings")
      .select("max_discount_percentage")
      .eq("setting_key", "global")
      .maybeSingle(),
    supabase
      .from("quotation_tax_profiles")
      .select("id, code, display_name, rate_percentage, is_active")
      .order("code", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Commercial quotation settings</h1>
        <p className="mt-1 text-xs text-neutral-400">
          Super Admin only. Tax catalogue and maximum discount bound are not production-seeded.
        </p>
      </div>
      <QuotationCommercialSettingsAdmin
        initialMaxDiscount={settingsRows?.max_discount_percentage ?? null}
        taxProfiles={taxProfiles ?? []}
        onSaveMaxDiscount={setQuotationMaxDiscountAction}
        onCreateTaxProfile={adminCreateTaxProfileAction}
        onUpdateTaxProfile={adminUpdateTaxProfileAction}
      />
    </div>
  );
}
