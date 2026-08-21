import Link from "next/link";
import type { ReactNode } from "react";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts.ts";
import type { ProductWorkspaceRow } from "../domain/commerce-dashboard.ts";
import type { CommerceCategoryRow } from "../server/commerce-queries.ts";

const fieldClass =
  "min-h-11 rounded-[8px] border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 text-sm text-[var(--od-text)]";

function statusClass(status: string): string {
  if (status === "published") return "text-[var(--od-positive)]";
  if (status === "archived") return "text-[var(--od-muted)]";
  return "text-[var(--od-warning)]";
}

export function ProductWorkspaceTable({
  rows,
  categories,
  filters,
  emptyState,
}: {
  readonly rows: readonly ProductWorkspaceRow[];
  readonly categories: readonly CommerceCategoryRow[];
  readonly filters: {
    readonly q: string;
    readonly status: string;
    readonly category: string;
    readonly featured: string;
    readonly mode: string;
    readonly media: string;
  };
  readonly emptyState?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search name, slug, reference"
          aria-label="Search products"
          className={`${fieldClass} min-w-56`}
        />
        <select name="category" defaultValue={filters.category} aria-label="Category" className={fieldClass}>
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status} aria-label="Status" className={fieldClass}>
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select name="mode" defaultValue={filters.mode} aria-label="Stock mode" className={fieldClass}>
          <option value="all">All modes</option>
          <option value="ready_stock">Ready Stock</option>
          <option value="made_to_order">Made to Order</option>
        </select>
        <select name="featured" defaultValue={filters.featured} aria-label="Featured" className={fieldClass}>
          <option value="all">Featured: all</option>
          <option value="true">Featured</option>
          <option value="false">Not featured</option>
        </select>
        <select name="media" defaultValue={filters.media} aria-label="Media readiness" className={fieldClass}>
          <option value="all">Media: all</option>
          <option value="ready">Public media ready</option>
          <option value="missing">Missing public media</option>
        </select>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-[8px] border border-[var(--od-border-strong)] px-3 text-xs font-semibold text-[var(--od-text)]"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        emptyState ?? (
          <div className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-8 text-center">
            <p className="text-sm text-[var(--od-text)]">No products match these filters</p>
            <p className="mt-1 text-xs text-[var(--od-muted)]">Adjust filters to see catalogue products.</p>
          </div>
        )
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-4 transition duration-150 hover:border-[var(--od-border-strong)]"
              >
                <div className="flex gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-[var(--od-gold)]/10 font-semibold text-[var(--od-gold)]">
                    {row.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--od-text)]">{row.name}</p>
                    <p className="truncate text-xs text-[var(--od-muted)]">
                      {row.product_reference} · {row.slug}
                    </p>
                    <p className="mt-1 text-xs text-[var(--od-muted)]">
                      {row.categoryName} · {row.modeLabel} · {row.availableLabel}
                    </p>
                    <p className={`text-xs ${statusClass(row.status)}`}>{row.status}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/admin/commerce/products/${row.id}`}
                    className="text-xs font-medium text-[var(--od-gold)]"
                  >
                    View / Edit
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] md:block">
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead className="border-b border-[var(--od-border)] text-[10px] uppercase tracking-wider text-[var(--od-muted)]">
                <tr>
                  <th className="p-3">Image</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Variants</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Available</th>
                  <th className="p-3">Featured</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Updated</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--od-border)]">
                {rows.map((row) => (
                  <tr key={row.id} className="transition duration-150 hover:bg-[var(--od-hover)]">
                    <td className="p-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[var(--od-gold)]/10 font-semibold text-[var(--od-gold)]">
                        {row.name.slice(0, 1)}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-[var(--od-text)]">{row.name}</p>
                      <p className="text-[11px] text-[var(--od-muted)]">
                        {row.product_reference} · {row.slug}
                      </p>
                    </td>
                    <td className="p-3 text-[var(--od-text-2)]">{row.categoryName}</td>
                    <td className="p-3">{row.variantCount}</td>
                    <td className="p-3">{row.startingPricePaise == null ? "—" : formatInrFromPaise(row.startingPricePaise)}</td>
                    <td className="p-3">{row.modeLabel}</td>
                    <td className="p-3">{row.availableLabel}</td>
                    <td className="p-3">{row.featured ? "Yes" : "—"}</td>
                    <td className={`p-3 capitalize ${statusClass(row.status)}`}>{row.status}</td>
                    <td className="p-3 text-[var(--od-muted)]">
                      {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(row.updatedAt))}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/commerce/products/${row.id}`}
                        className="font-medium text-[var(--od-gold)]"
                      >
                        View / Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
