import Link from "next/link";

export default function CrmLeadNotFound() {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-10 text-center">
      <h1 className="text-lg font-semibold text-neutral-50">Lead not found</h1>
      <p className="mt-2 text-sm text-neutral-400">
        This lead is unavailable or you do not have permission to view it.
      </p>
      <Link
        href="/admin/crm/leads"
        className="mt-5 inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
      >
        Back to leads
      </Link>
    </section>
  );
}
