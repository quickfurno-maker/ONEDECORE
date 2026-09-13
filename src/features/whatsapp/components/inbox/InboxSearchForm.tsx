import type { InboxListQuery } from "../../contracts/inbox-list-query.ts";

/**
 * Search by name or number.
 *
 * A GET form, unchanged: the query lives in the URL, so a search is
 * shareable, back works, and the server does the filtering. What changed is
 * that it now wears the workspace's own styles instead of the admin
 * default. It was the last piece of the left pane still drawn in the old
 * kit — on a phone the submit button rendered as a full-width green slab
 * above the conversations, which read as the most important thing in the
 * pane rather than the least.
 *
 * `Apply` sits beside the field on every width, which is what freed the row.
 * The visible "SEARCH" caption is gone with it: one search box, next to a
 * button that says Apply, in a pane of conversations, does not need a heading
 * to explain itself, and the caption was costing a line in the part of the
 * screen the list wants. The label survives for assistive technology, where
 * the placeholder is not a substitute for one.
 */

interface InboxSearchFormProps {
  readonly query: InboxListQuery;
}

export function InboxSearchForm({ query }: InboxSearchFormProps) {
  return (
    <form action="/admin/whatsapp/inbox" method="get" className="od-wa__search">
      {/*
        The link filter rides along, or applying a search would silently drop
        it and widen the list the reader had deliberately narrowed.
      */}
      {query.linkFilter !== "all" ? (
        <input type="hidden" name="link" value={query.linkFilter} />
      ) : null}

      <label className="sr-only" htmlFor="od-wa-search">
        Search conversations by name or phone number
      </label>
      <input
        id="od-wa-search"
        type="search"
        name="q"
        className="od-wa__input"
        defaultValue={query.q ?? ""}
        placeholder="Search name or number"
      />
      <button type="submit" className="od-wa__btn od-wa__btn--quiet">
        Apply
      </button>
    </form>
  );
}
