export type ProductWorkspaceFilters = {
  readonly q: string;
  readonly status: string;
  readonly category: string;
  readonly featured: string;
  readonly mode: string;
  readonly media: string;
};

export function hasActiveProductFilters(filters: ProductWorkspaceFilters): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.status !== "all" ||
    filters.category !== "all" ||
    filters.featured !== "all" ||
    filters.mode !== "all" ||
    filters.media !== "all"
  );
}

export function shouldShowCatalogueOnboardingEmpty(input: {
  readonly rowCount: number;
  readonly returnedProductCount: number;
  readonly filters: ProductWorkspaceFilters;
}): boolean {
  return (
    input.rowCount === 0 &&
    input.returnedProductCount === 0 &&
    !hasActiveProductFilters(input.filters)
  );
}
