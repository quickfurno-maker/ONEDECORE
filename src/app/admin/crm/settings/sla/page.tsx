import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { SlaSettingsPanel } from "@/features/crm/components/settings/SlaSettingsPanel";
import { requireCrmSlaPolicyAccess } from "@/features/crm/server/crm-auth";
import { fetchFirstContactSlaPolicy } from "@/features/crm/server/crm-sla-policy-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SLA Settings | ONEDECORE",
  description:
    "Configure the first-contact response SLA target, timezone and business hours.",
};

export default async function CrmSlaSettingsPage() {
  await requireCrmSlaPolicyAccess();
  const policy = await fetchFirstContactSlaPolicy();

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="SLA Settings"
        description="Set the first-contact response target and the business hours it is measured inside. The clock runs only during open hours in the configured timezone."
      />
      <SlaSettingsPanel policy={policy} />
    </div>
  );
}
