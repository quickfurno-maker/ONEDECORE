import Link from "next/link";

export default function CrmLeadNotFound() {
  return (
    <section className="crm-surface px-6 py-10 text-center">
      <h1 className="text-lg font-semibold text-[var(--crm-text)]">Lead not found</h1>
      <p className="mt-2 text-sm text-[var(--crm-muted)]">
        This lead is unavailable or you do not have permission to view it.
      </p>
      <Link href="/admin/crm/leads" className="crm-btn crm-btn-secondary mt-5">
        Back to leads
      </Link>
    </section>
  );
}
