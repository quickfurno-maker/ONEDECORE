import Link from "next/link";
import { DashboardPanel } from "@/features/admin-ops/components/DashboardPanel.tsx";
import { MetricCard } from "@/features/admin-ops/components/MetricCard.tsx";
import { NeedsAttentionPanel } from "@/features/admin-ops/components/NeedsAttentionPanel.tsx";
import { OpsIcon } from "@/features/admin-ops/components/OpsIcon.tsx";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts.ts";
import type { CommerceDashboardSnapshot } from "../domain/commerce-dashboard.ts";

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--od-hover)]">
      <div
        className="h-full rounded-full transition-[width] duration-200"
        style={{ width: `${width}%`, background: color }}
      />
    </div>
  );
}

export function CommerceDashboardView({
  snapshot,
  canManageCatalog,
}: {
  readonly snapshot: CommerceDashboardSnapshot;
  readonly canManageCatalog: boolean;
}) {
  const healthTotal = snapshot.health.published + snapshot.health.draft + snapshot.health.archived;
  const healthMax = Math.max(healthTotal, 1);
  const distMax = Math.max(...snapshot.distribution.map((row) => row.published), 1);
  const invMax = Math.max(...(snapshot.inventory?.byRootCategory.map((row) => row.available) ?? [0]), 1);

  return (
    <div className="space-y-6 lg:space-y-7">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {snapshot.kpis.map((item, index) => (
          <MetricCard key={item.id} item={item} index={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DashboardPanel
            title="Catalogue Health"
            action={
              snapshot.health.draft > 0 ? (
                <Link
                  href="/admin/commerce/products?status=draft"
                  className="text-xs font-medium text-[var(--od-gold)]"
                >
                  Review Drafts
                </Link>
              ) : null
            }
          >
            {healthTotal === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--od-text)]">No products yet</p>
                <p className="text-xs text-[var(--od-muted)]">
                  Start by creating your first catalogue product.
                </p>
                {canManageCatalog ? (
                  <Link
                    href="/admin/commerce/products"
                    className="inline-flex min-h-10 items-center rounded-[8px] bg-[var(--od-gold)] px-4 text-sm font-semibold text-[#1a1408]"
                  >
                    Add Product
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[var(--od-muted)]">Published</p>
                    <p className="text-xl font-semibold text-[var(--od-text)]">{snapshot.health.published}</p>
                  </div>
                  <div>
                    <p className="text-[var(--od-muted)]">Draft</p>
                    <p className="text-xl font-semibold text-[var(--od-text)]">{snapshot.health.draft}</p>
                  </div>
                  <div>
                    <p className="text-[var(--od-muted)]">Needs Attention</p>
                    <p className="text-xl font-semibold text-[var(--od-warning)]">{snapshot.health.needsAttention}</p>
                  </div>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-[var(--od-hover)]">
                  <div
                    className="bg-[var(--od-positive)] transition-[width] duration-200"
                    style={{ width: `${(snapshot.health.published / healthMax) * 100}%` }}
                  />
                  <div
                    className="bg-[var(--od-warning)] transition-[width] duration-200"
                    style={{ width: `${(snapshot.health.draft / healthMax) * 100}%` }}
                  />
                  <div
                    className="bg-[var(--od-muted)]/40 transition-[width] duration-200"
                    style={{ width: `${(snapshot.health.archived / healthMax) * 100}%` }}
                  />
                </div>
                {snapshot.health.archived > 0 ? (
                  <p className="text-xs text-[var(--od-muted)]">Archived {snapshot.health.archived}</p>
                ) : null}
              </div>
            )}
          </DashboardPanel>
        </div>
        <NeedsAttentionPanel items={snapshot.attention} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Inventory Snapshot">
          {snapshot.inventory ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-[var(--od-muted)]">Ready Stock SKUs</p>
                  <p className="text-lg font-semibold">{snapshot.inventory.readyStockSkus}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--od-muted)]">Available Units</p>
                  <p className="text-lg font-semibold">{snapshot.inventory.availableUnits}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--od-muted)]">Reserved Units</p>
                  <p className="text-lg font-semibold">{snapshot.inventory.reservedUnits}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--od-muted)]">Zero Stock</p>
                  <p className="text-lg font-semibold text-[var(--od-warning)]">{snapshot.inventory.zeroStock}</p>
                </div>
              </div>
              {snapshot.inventory.byRootCategory.length === 0 ? (
                <p className="text-sm text-[var(--od-muted)]">No ready-stock availability to group by category.</p>
              ) : (
                <ul className="space-y-3">
                  {snapshot.inventory.byRootCategory.map((row) => (
                    <li key={row.name}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[var(--od-text-2)]">{row.name}</span>
                        <span className="text-[var(--od-muted)]">{row.available} available</span>
                      </div>
                      <Bar value={row.available} max={invMax} color="var(--od-teal)" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--od-muted)]">Inventory figures are hidden for this permission.</p>
          )}
        </DashboardPanel>

        <DashboardPanel title="Storefront Readiness">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-[10px] border border-[var(--od-border)] bg-[var(--od-elevated)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--od-muted)]">Ready</p>
              <p className="text-2xl font-semibold text-[var(--od-positive)]">{snapshot.readiness.readyPublished}</p>
              <p className="text-xs text-[var(--od-muted)]">products</p>
            </div>
            <div className="rounded-[10px] border border-[var(--od-border)] bg-[var(--od-elevated)] p-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--od-muted)]">Needs Attention</p>
              <p className="text-2xl font-semibold text-[var(--od-warning)]">
                {snapshot.readiness.needsAttentionProducts}
              </p>
              <p className="text-xs text-[var(--od-muted)]">products</p>
            </div>
          </div>
          <ul className="space-y-2">
            {snapshot.readiness.checks.map((check) => (
              <li key={check.label} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${
                    check.ok
                      ? "bg-[var(--od-positive)]/15 text-[var(--od-positive)]"
                      : "bg-[var(--od-warning)]/15 text-[var(--od-warning)]"
                  }`}
                >
                  <OpsIcon name={check.ok ? "leave" : "alert"} className="h-3 w-3" />
                </span>
                <span>
                  <span className="text-[var(--od-text)]">{check.label}</span>
                  <span className="block text-xs text-[var(--od-muted)]">{check.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel
          title="Featured Products"
          action={
            <Link href="/admin/commerce/products?featured=true" className="text-xs font-medium text-[var(--od-gold)]">
              View All Products
            </Link>
          }
        >
          {snapshot.featured.length === 0 ? (
            <p className="text-sm text-[var(--od-muted)]">
              No featured products. Mark published products as featured to surface them on the storefront.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.featured.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/commerce/products/${item.id}`}
                  className="rounded-[10px] border border-[var(--od-border)] bg-[var(--od-elevated)] p-3 transition duration-150 hover:border-[var(--od-gold)]/40"
                >
                  <div className="mb-2 flex h-16 items-center justify-center rounded-[8px] bg-[var(--od-gold)]/10 text-sm font-semibold text-[var(--od-gold)]">
                    {item.name.slice(0, 1)}
                  </div>
                  <p className="truncate text-sm font-medium text-[var(--od-text)]">{item.name}</p>
                  <p className="text-xs text-[var(--od-muted)]">{item.categoryName}</p>
                  <p className="mt-1 text-sm text-[var(--od-text-2)]">
                    {item.startingPricePaise == null ? "—" : formatInrFromPaise(item.startingPricePaise)}
                  </p>
                  <p className="text-[11px] text-[var(--od-muted)]">
                    {item.stockMode} · {item.status}
                    {item.hasPublicPrimary ? "" : " · media pending"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel title="Category Distribution">
          {snapshot.distribution.length === 0 ? (
            <p className="text-sm text-[var(--od-muted)]">No active root categories.</p>
          ) : (
            <ul className="space-y-3">
              {snapshot.distribution.map((row) => (
                <li key={row.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[var(--od-text)]">{row.name}</span>
                    <span className="text-[var(--od-muted)]">{row.published} published</span>
                  </div>
                  <Bar value={row.published} max={distMax} color="var(--od-gold)" />
                  <p className="mt-1 text-[11px] text-[var(--od-muted)]">
                    Draft {row.draft} · Featured {row.featured}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel
          title="Delivery Coverage"
          action={
            <Link href="/admin/commerce/settings" className="text-xs font-medium text-[var(--od-gold)]">
              Manage Pincodes
            </Link>
          }
        >
          {snapshot.coverage.serviceable === 0 && snapshot.coverage.unserviceable === 0 ? (
            <p className="text-sm text-[var(--od-muted)]">
              No serviceable pincodes. Add delivery pincodes before storefront activation.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[var(--od-muted)]">Serviceable Pincodes</p>
                  <p className="text-xl font-semibold">{snapshot.coverage.serviceable}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--od-muted)]">Non-serviceable</p>
                  <p className="text-xl font-semibold">{snapshot.coverage.unserviceable}</p>
                </div>
              </div>
              <p className="text-[11px] text-[var(--od-muted)]">
                Display groups use zone codes. Checkout still uses pincode serviceability, not city names.
              </p>
              <ul className="space-y-2">
                {snapshot.coverage.groups.map((group) => (
                  <li key={group.label} className="flex justify-between text-sm">
                    <span className="text-[var(--od-text-2)]">{group.label}</span>
                    <span className="text-[var(--od-muted)]">{group.count}</span>
                  </li>
                ))}
              </ul>
              {snapshot.coverage.lastUpdated ? (
                <p className="text-[11px] text-[var(--od-muted)]">
                  Last updated{" "}
                  {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(snapshot.coverage.lastUpdated)
                  )}
                </p>
              ) : null}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel title="Recently Updated Products">
          {snapshot.recent.length === 0 ? (
            <p className="text-sm text-[var(--od-muted)]">No catalogue updates yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-[var(--od-border)] pl-4">
              {snapshot.recent.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-[23px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--od-gold)]/15 text-[var(--od-gold)]">
                    <OpsIcon name="products" className="h-3 w-3" />
                  </span>
                  <Link href={`/admin/commerce/products/${item.id}`} className="block hover:text-[var(--od-gold)]">
                    <p className="text-sm font-medium text-[var(--od-text)]">{item.name}</p>
                    <p className="text-xs text-[var(--od-muted)]">{item.status}</p>
                    <p className="mt-1 text-[11px] text-[var(--od-muted)]">
                      {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
                        new Date(item.updatedAt)
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
