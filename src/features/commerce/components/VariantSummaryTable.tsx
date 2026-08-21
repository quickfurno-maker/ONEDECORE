import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts.ts";
import type { CommerceInventoryRow, CommerceVariantRow } from "../server/commerce-queries.ts";

function option(variant: CommerceVariantRow, key: string): string {
  return variant.option_values[key] ?? "—";
}

export function VariantSummaryTable({
  variants,
  inventory,
}: {
  readonly variants: readonly CommerceVariantRow[];
  readonly inventory: readonly CommerceInventoryRow[];
}) {
  const byVariant = new Map(inventory.map((row) => [row.variant_id, row]));
  if (variants.length === 0) {
    return <p className="text-sm text-[var(--od-muted)]">No variants yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-[var(--od-muted)]">
          <tr>
            <th className="py-2 pr-3">SKU</th>
            <th className="py-2 pr-3">Color</th>
            <th className="py-2 pr-3">Finish</th>
            <th className="py-2 pr-3">Size</th>
            <th className="py-2 pr-3">Upholstery</th>
            <th className="py-2 pr-3">Price</th>
            <th className="py-2 pr-3">Compare-at</th>
            <th className="py-2 pr-3">Mode</th>
            <th className="py-2 pr-3">Stock</th>
            <th className="py-2 pr-3">Reserved</th>
            <th className="py-2 pr-3">Available</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--od-border)]">
          {variants.map((variant) => {
            const inv = byVariant.get(variant.id);
            const available = inv ? inv.stock_on_hand - inv.reserved_qty : null;
            return (
              <tr key={variant.id} className="text-[var(--od-text-2)]">
                <td className="py-2 pr-3 font-medium text-[var(--od-text)]">{variant.sku}</td>
                <td className="py-2 pr-3">{option(variant, "color")}</td>
                <td className="py-2 pr-3">{option(variant, "finish")}</td>
                <td className="py-2 pr-3">{option(variant, "size")}</td>
                <td className="py-2 pr-3">{option(variant, "upholstery")}</td>
                <td className="py-2 pr-3">{formatInrFromPaise(variant.selling_price_paise)}</td>
                <td className="py-2 pr-3">
                  {variant.compare_at_price_paise == null ? "—" : formatInrFromPaise(variant.compare_at_price_paise)}
                </td>
                <td className="py-2 pr-3">
                  {variant.availability_mode === "ready_stock" ? "Ready Stock" : "Made to Order"}
                </td>
                <td className="py-2 pr-3">{inv?.stock_on_hand ?? "—"}</td>
                <td className="py-2 pr-3">{inv?.reserved_qty ?? "—"}</td>
                <td className="py-2 pr-3">{available ?? "—"}</td>
                <td className="py-2 capitalize">{variant.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
