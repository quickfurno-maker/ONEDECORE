import type { ReactNode } from "react";
import type { CommerceCategoryRow } from "../server/commerce-queries.ts";

export function CategoryTree({
  categories,
  productCounts,
  editors,
}: {
  readonly categories: readonly CommerceCategoryRow[];
  readonly productCounts: Readonly<Record<string, number>>;
  readonly editors: Readonly<Record<string, ReactNode>>;
}) {
  const roots = categories
    .filter((row) => row.parent_category_id === null)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const childrenOf = (id: string) =>
    categories
      .filter((row) => row.parent_category_id === id)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  if (roots.length === 0) {
    return <p className="text-sm text-[var(--od-muted)]">No categories yet.</p>;
  }

  return (
    <div className="space-y-4">
      {roots.map((root) => (
        <section
          key={root.id}
          className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-4"
        >
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[17px] font-semibold text-[var(--od-text)]">{root.name}</h2>
              <p className="text-xs text-[var(--od-muted)]">
                {root.status} · {productCounts[root.id] ?? 0} products · sort {root.sort_order}
                {root.seo_title ? " · SEO title set" : " · SEO title missing"}
              </p>
            </div>
          </header>
          {editors[root.id]}
          <div className="mt-3 space-y-3 border-l border-[var(--od-border)] pl-4">
            {childrenOf(root.id).length === 0 ? (
              <p className="text-xs text-[var(--od-muted)]">No subcategories.</p>
            ) : (
              childrenOf(root.id).map((child) => (
                <div key={child.id}>
                  <p className="text-sm font-medium text-[var(--od-text)]">{child.name}</p>
                  <p className="text-xs text-[var(--od-muted)]">
                    {child.status} · {productCounts[child.id] ?? 0} products · sort {child.sort_order}
                    {child.seo_title ? " · SEO title set" : " · SEO title missing"}
                  </p>
                  {editors[child.id]}
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
