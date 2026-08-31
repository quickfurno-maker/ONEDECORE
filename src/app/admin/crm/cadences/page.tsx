import type { Metadata } from "next";
import Link from "next/link";
import { CadenceList } from "@/features/crm/components/cadences/CadenceList";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { requireCrmCadenceAccess } from "@/features/crm/server/crm-auth";
import { fetchCadenceTemplates } from "@/features/crm/server/crm-cadence-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cadences | ONEDECORE CRM",
  description:
    "Sales playbook cadences that schedule canonical CRM follow-up activities.",
};

export default async function CrmCadencesPage() {
  await requireCrmCadenceAccess();
  const templates = await fetchCadenceTemplates();

  return (
    <div className="space-y-5">
      <CrmPageHeader
        title="Cadences"
        description="A cadence schedules the next follow-up activity for a person to perform. Steps appear in My Day and Calendar as ordinary activities; nothing is ever sent automatically."
        actions={
          <Link
            href="/admin/crm/cadences/new"
            className="crm-btn crm-btn-primary"
            data-testid="crm-cadence-new"
          >
            New cadence
          </Link>
        }
      />
      <CadenceList templates={templates} />
    </div>
  );
}
