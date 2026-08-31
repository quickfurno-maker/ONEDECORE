import type { Metadata } from "next";
import Link from "next/link";
import { CadenceDraftEditor } from "@/features/crm/components/cadences/CadenceDraftEditor";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { requireCrmCadenceAccess } from "@/features/crm/server/crm-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Cadence | ONEDECORE CRM",
  description: "Create a draft sales cadence with ordered follow-up steps.",
};

export default async function NewCrmCadencePage() {
  await requireCrmCadenceAccess("/admin/crm/cadences/new");

  return (
    <div className="space-y-5">
      <Link
        href="/admin/crm/cadences"
        className="crm-btn crm-btn-ghost min-h-10 px-2 text-[13px]"
      >
        ← Back to cadences
      </Link>
      <CrmPageHeader
        title="New cadence"
        description="Drafts are private until published. Only a published cadence can be enrolled on a lead."
      />
      <CadenceDraftEditor />
    </div>
  );
}
