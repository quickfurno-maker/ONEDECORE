import Link from "next/link";

interface LeadListEmptyProps {
  readonly filtered: boolean;
  readonly canCreate?: boolean;
}

export function LeadListEmpty({ filtered, canCreate = false }: LeadListEmptyProps) {
  return (
    <div className="rounded-[12px] border border-dashed border-[var(--od-border-strong)] bg-[var(--od-surface)] px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-[var(--od-text)]">
        {filtered ? "No leads match these filters." : "No leads yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--od-muted)]">
        {filtered
          ? "Try adjusting your search or filter criteria."
          : "New leads will appear here as they are created or assigned."}
      </p>
      {filtered ? (
        <Link
          href="/admin/crm/leads"
          className="mt-5 inline-flex min-h-10 items-center rounded-[8px] border border-[var(--od-border-strong)] px-4 text-sm"
        >
          Clear filters
        </Link>
      ) : canCreate ? (
        <Link
          href="/admin/crm/leads/new"
          className="mt-5 inline-flex min-h-10 items-center rounded-[8px] bg-[var(--od-gold)] px-4 text-sm font-semibold text-[#1a1408]"
        >
          Create New Lead
        </Link>
      ) : null}
    </div>
  );
}
