interface LeadListEmptyProps {
  readonly filtered: boolean;
}

export function LeadListEmpty({ filtered }: LeadListEmptyProps) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-neutral-100">
        {filtered ? "No leads match these filters" : "No leads visible"}
      </h2>
      <p className="mt-2 text-sm text-neutral-400">
        {filtered
          ? "Try adjusting your search or filter criteria."
          : "Leads assigned to you or visible under your CRM permissions will appear here."}
      </p>
    </div>
  );
}
