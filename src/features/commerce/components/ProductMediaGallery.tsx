import type { CommerceMediaRow, CommerceVariantRow } from "../server/commerce-queries.ts";

export function ProductMediaGallery({
  media,
  variants,
}: {
  readonly media: readonly CommerceMediaRow[];
  readonly variants: readonly CommerceVariantRow[];
}) {
  if (media.length === 0) {
    return <p className="text-sm text-[var(--od-muted)]">No media uploaded.</p>;
  }
  const skuById = new Map(variants.map((row) => [row.id, row.sku]));
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {media.map((item) => {
        const publicReady = item.public_path !== "";
        const originalUploaded = item.original_path !== "";
        return (
          <li
            key={item.id}
            className="rounded-[10px] border border-[var(--od-border)] bg-[var(--od-elevated)] p-3 text-xs"
          >
            <div className="mb-2 flex h-20 items-center justify-center rounded-[8px] bg-[var(--od-hover)] text-[var(--od-gold)]">
              {item.is_primary ? "Primary" : "Gallery"}
            </div>
            <p className="text-[var(--od-text)]">
              {item.variant_id ? `Variant ${skuById.get(item.variant_id) ?? item.variant_id}` : "Product-level"}
            </p>
            <p className="text-[var(--od-muted)]">{item.alt_text}</p>
            <ul className="mt-2 space-y-1 text-[var(--od-text-2)]">
              <li>{originalUploaded ? "Original uploaded" : "Original missing"}</li>
              <li>{publicReady ? "Public derivative finalized" : "Public derivative missing"}</li>
              <li>{item.is_primary ? "Primary" : "Not primary"}</li>
              <li className="capitalize">Status: {item.status}</li>
            </ul>
            {!publicReady ? (
              <p className="mt-2 text-[var(--od-warning)]">Public derivative is not finalized.</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
