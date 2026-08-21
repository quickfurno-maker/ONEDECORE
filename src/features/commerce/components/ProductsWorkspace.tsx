"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CommerceActionDrawer } from "./CommerceActionDrawer";
import { ProductCreateForm } from "./ProductCreateForm";
import { ProductWorkspaceTable } from "./ProductWorkspaceTable";
import { CommercePageHeader } from "./CommercePageHeader";
import { StorefrontDisabledBanner } from "./StorefrontDisabledBanner";
import { CommerceAdminLinks } from "./CommerceAdminLinks";
import type { ProductWorkspaceRow } from "../domain/commerce-dashboard";
import type { CommerceCategoryRow } from "../server/commerce-queries";
import { commerceGoldButtonClass } from "../ui/commerce-classes";

export function ProductsWorkspace({
  canManageCatalog,
  categories,
  rows,
  filters,
  catalogueEmpty,
}: {
  readonly canManageCatalog: boolean;
  readonly categories: readonly CommerceCategoryRow[];
  readonly rows: readonly ProductWorkspaceRow[];
  readonly filters: {
    readonly q: string;
    readonly status: string;
    readonly category: string;
    readonly featured: string;
    readonly mode: string;
    readonly media: string;
  };
  readonly catalogueEmpty: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasCategories = categories.length > 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader
        title="Products"
        subtitle="Catalogue workspace. Public /shop is off."
        actions={
          canManageCatalog ? (
            hasCategories ? (
              <button
                ref={triggerRef}
                type="button"
                className={commerceGoldButtonClass}
                onClick={() => setOpen(true)}
              >
                + Add Product
              </button>
            ) : (
              <Link href="/admin/commerce/categories" className={commerceGoldButtonClass}>
                Create Category
              </Link>
            )
          ) : null
        }
      />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <ProductWorkspaceTable
        rows={rows}
        categories={categories}
        filters={filters}
        emptyState={
          catalogueEmpty ? (
            <div className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] px-6 py-12 text-center">
              <p className="text-lg font-semibold text-[var(--od-text)]">Build your furniture catalogue</p>
              <p className="mt-2 text-sm text-[var(--od-muted)]">Create categories, then add products and variants.</p>
              {hasCategories ? null : (
                <p className="mt-2 text-sm text-[var(--od-text-2)]">Create your first category before adding products.</p>
              )}
              <div className="mt-5">
                {canManageCatalog ? (
                  hasCategories ? (
                    <button type="button" className={commerceGoldButtonClass} onClick={() => setOpen(true)}>
                      Add Product
                    </button>
                  ) : (
                    <Link href="/admin/commerce/categories" className={commerceGoldButtonClass}>
                      Create Category
                    </Link>
                  )
                ) : null}
              </div>
            </div>
          ) : undefined
        }
      />
      {canManageCatalog && hasCategories ? (
        <CommerceActionDrawer
          open={open}
          title="Add Product"
          onClose={() => setOpen(false)}
          triggerRef={triggerRef}
        >
          <ProductCreateForm categories={categories} />
        </CommerceActionDrawer>
      ) : null}
    </div>
  );
}
