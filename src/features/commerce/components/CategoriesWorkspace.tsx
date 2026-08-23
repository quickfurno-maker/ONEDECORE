"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CategoryForm } from "./CategoryForm";
import { CategoryTree } from "./CategoryTree";
import { CommerceActionDrawer } from "./CommerceActionDrawer";
import { CommerceAdminLinks } from "./CommerceAdminLinks";
import { CommercePageHeader } from "./CommercePageHeader";
import { StorefrontDisabledBanner } from "./StorefrontDisabledBanner";
import type { CommerceCategoryRow } from "../server/commerce-queries";
import {
  COMMERCE_EXAMPLE_CATEGORIES,
  commerceCompactButtonClass,
  commerceGoldButtonClass,
} from "../ui/commerce-classes";

export function CategoriesWorkspace({
  canManageCatalog,
  categories,
  productCounts,
}: {
  readonly canManageCatalog: boolean;
  readonly categories: readonly CommerceCategoryRow[];
  readonly productCounts: Readonly<Record<string, number>>;
}) {
  const [mode, setMode] = useState<{ kind: "create" } | { kind: "edit"; category: CommerceCategoryRow } | null>(null);
  const roots = categories.filter((row) => row.parent_category_id === null);
  const editors: Record<string, ReactNode> = {};
  for (const category of categories) {
    editors[category.id] = canManageCatalog ? (
      <button
        type="button"
        className={`${commerceCompactButtonClass} mt-2`}
        onClick={() => setMode({ kind: "edit", category })}
      >
        Edit
      </button>
    ) : (
      <p className="mt-2 text-xs text-[var(--od-muted)]">
        {category.category_reference} · {category.slug}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader
        title="Categories"
        subtitle="Root categories and one subcategory depth."
        actions={
          canManageCatalog ? (
            <button type="button" className={commerceGoldButtonClass} onClick={() => setMode({ kind: "create" })}>
              + Add Category
            </button>
          ) : null
        }
      />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      {categories.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] px-6 py-12 text-center">
          <p className="text-lg font-semibold text-[var(--od-text)]">Build your furniture catalogue</p>
          <p className="mt-2 text-sm text-[var(--od-muted)]">
            Start with a root category, then add one level of subcategories.
          </p>
          <p className="mt-3 text-xs text-[var(--od-muted)]">
            Suggestions: {COMMERCE_EXAMPLE_CATEGORIES.join(" · ")}
          </p>
          {canManageCatalog ? (
            <button type="button" className={`${commerceGoldButtonClass} mt-5`} onClick={() => setMode({ kind: "create" })}>
              Create First Category
            </button>
          ) : null}
        </div>
      ) : (
        <CategoryTree categories={categories} productCounts={productCounts} editors={editors} />
      )}
      {canManageCatalog ? (
        <CommerceActionDrawer
          open={mode != null}
          title={mode?.kind === "edit" ? `Edit ${mode.category.name}` : "Add Category"}
          onClose={() => setMode(null)}
        >
          {mode?.kind === "edit" ? (
            <CategoryForm category={mode.category} rootCategories={roots} />
          ) : (
            <CategoryForm rootCategories={roots} />
          )}
        </CommerceActionDrawer>
      ) : null}
    </div>
  );
}
