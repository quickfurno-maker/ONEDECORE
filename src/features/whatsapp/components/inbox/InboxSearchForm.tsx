import type { InboxListQuery } from "../../contracts/inbox-list-query.ts";

interface InboxSearchFormProps {
  readonly query: InboxListQuery;
}

export function InboxSearchForm({ query }: InboxSearchFormProps) {
  return (
    <form
      action="/admin/whatsapp/inbox"
      method="get"
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      {query.linkFilter !== "all" ? (
        <input type="hidden" name="link" value={query.linkFilter} />
      ) : null}
      <label className="flex-1 text-sm text-neutral-300">
        <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
          Search
        </span>
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Name or phone"
          className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        />
      </label>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
      >
        Apply
      </button>
    </form>
  );
}
