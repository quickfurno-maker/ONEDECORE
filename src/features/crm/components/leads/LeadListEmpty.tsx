import Link from "next/link";

interface LeadListEmptyProps {
  readonly filtered: boolean;
  readonly canCreate?: boolean;
}

export function LeadListEmpty({ filtered, canCreate = false }: LeadListEmptyProps) {
  return (
    <div className="crm-surface border-dashed px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-[var(--crm-text)]">
        {filtered ? "No leads match these filters." : "No leads yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--crm-muted)]">
        {filtered
          ? "Try adjusting your search or filter criteria."
          : "New leads will appear here as they are created or assigned."}
      </p>
      {filtered ? (
        <Link href="/admin/crm/leads" className="crm-btn crm-btn-secondary mt-5">
          Clear filters
        </Link>
      ) : canCreate ? (
        <Link href="/admin/crm/leads/new" className="crm-btn crm-btn-primary mt-5">
          Create New Lead
        </Link>
      ) : null}
    </div>
  );
}
