import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { AutomationWorkspace } from "@/features/commerce/automation/components/AutomationWorkspace";
import {
  canManageCommerceAutomation,
  loadCommerceAutomationDashboard,
} from "@/features/commerce/automation/server/automation-queries";
import {
  getCommerceAutomationWorkerSecret,
  isCommerceAutomationEnabled,
} from "@/features/commerce/automation/server/automation-env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Commerce automations | ONEDECORE Operations" };

export default async function CommerceAutomationsPage() {
  const session = await getStaffClaims();
  if (!session) redirect("/auth/login?portal=admin&next=%2Fadmin%2Fcommerce%2Fautomations");
  if (!(await canManageCommerceAutomation())) redirect("/auth/forbidden");

  const data = await loadCommerceAutomationDashboard();
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader
        title="Commerce Automations"
        subtitle="Isolated ecommerce lifecycle automation. External messaging is intentionally disconnected."
      />
      <CommerceAdminLinks />
      <AutomationWorkspace
        data={data}
        engineEnabled={isCommerceAutomationEnabled()}
        workerReady={Boolean(getCommerceAutomationWorkerSecret())}
      />
    </div>
  );
}
