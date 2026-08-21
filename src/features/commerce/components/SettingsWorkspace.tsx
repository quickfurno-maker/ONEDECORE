"use client";

import { useRef, useState } from "react";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts.ts";
import { CommerceActionDrawer } from "./CommerceActionDrawer";
import { CommerceAdminLinks } from "./CommerceAdminLinks";
import { CommercePageHeader } from "./CommercePageHeader";
import { PincodeForm } from "./PincodeForm";
import { ShippingSettingsForm } from "./ShippingSettingsForm";
import { StorefrontDisabledBanner } from "./StorefrontDisabledBanner";
import { TaxRateForm } from "./TaxRateForm";
import { TaxSettingsForm } from "./TaxSettingsForm";
import type {
  CommercePincodeRow,
  CommerceShippingSettingsRow,
  CommerceTaxRateRow,
  CommerceTaxSettingsRow,
} from "../server/commerce-queries";
import { commerceCompactButtonClass, commerceGoldButtonClass } from "../ui/commerce-classes";
import { basisPointsToPercentInput } from "../ui/operator-units";

type SettingsPanel =
  | { kind: "tax" }
  | { kind: "tax-rate"; rate?: CommerceTaxRateRow }
  | { kind: "shipping" }
  | { kind: "pincode"; row?: CommercePincodeRow };

export function SettingsWorkspace({
  canManageSettings,
  taxSettings,
  taxRates,
  shipping,
  pincodes,
}: {
  readonly canManageSettings: boolean;
  readonly taxSettings: CommerceTaxSettingsRow | null;
  readonly taxRates: readonly CommerceTaxRateRow[];
  readonly shipping: CommerceShippingSettingsRow | null;
  readonly pincodes: readonly CommercePincodeRow[];
}) {
  const [panel, setPanel] = useState<SettingsPanel | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const serviceable = pincodes.filter((row) => row.serviceable).length;
  const groups = new Map<string, number>();
  for (const row of pincodes.filter((item) => item.serviceable)) {
    const label = row.zone_code?.trim() || "Ungrouped";
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }

  const title =
    panel?.kind === "tax"
      ? "Tax & GST"
      : panel?.kind === "tax-rate"
        ? panel.rate
          ? `Edit ${panel.rate.code}`
          : "Add tax rate"
        : panel?.kind === "shipping"
          ? "Shipping & COD"
          : panel?.kind === "pincode"
            ? panel.row
              ? `Edit ${panel.row.pincode}`
              : "Add pincode"
            : "Settings";

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader title="Commerce settings" subtitle="Tax, shipping, COD, and pincode serviceability." />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-[var(--od-text)]">Tax & GST</h2>
            {canManageSettings ? (
              <button
                ref={panel?.kind === "tax" ? triggerRef : undefined}
                type="button"
                className={commerceCompactButtonClass}
                onClick={() => setPanel({ kind: "tax" })}
              >
                Manage
              </button>
            ) : null}
          </div>
          <dl className="space-y-2 text-sm text-[var(--od-text-2)]">
            <div className="flex justify-between gap-3">
              <dt>GST-inclusive pricing</dt>
              <dd className="font-medium text-[var(--od-gold)]">Locked ON</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Tax required to publish</dt>
              <dd>{taxSettings?.tax_required_for_publish ?? true ? "Enabled" : "Disabled"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Configured rates</dt>
              <dd>{taxRates.length}</dd>
            </div>
          </dl>
          {taxRates.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--od-muted)]">No tax rates configured.</p>
          ) : (
            <ul className="mt-4 space-y-1 text-sm text-[var(--od-text-2)]">
              {taxRates.map((rate) => (
                <li key={rate.id} className="flex items-center justify-between gap-2">
                  <span>
                    {rate.code} · {basisPointsToPercentInput(rate.rate_basis_points)}% ·{" "}
                    {rate.is_active ? "active" : "inactive"}
                  </span>
                  {canManageSettings ? (
                    <button type="button" className={commerceCompactButtonClass} onClick={() => setPanel({ kind: "tax-rate", rate })}>
                      Edit
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canManageSettings ? (
            <button type="button" className={`${commerceCompactButtonClass} mt-4`} onClick={() => setPanel({ kind: "tax-rate" })}>
              Add tax rate
            </button>
          ) : null}
        </section>

        <section className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-[var(--od-text)]">Shipping</h2>
            {canManageSettings ? (
              <button type="button" className={commerceCompactButtonClass} onClick={() => setPanel({ kind: "shipping" })}>
                Manage
              </button>
            ) : null}
          </div>
          {shipping ? (
            <dl className="space-y-2 text-sm text-[var(--od-text-2)]">
              <div className="flex justify-between gap-3">
                <dt>Default shipping</dt>
                <dd>{formatInrFromPaise(shipping.default_shipping_charge_paise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Free shipping threshold</dt>
                <dd>
                  {shipping.free_shipping_threshold_paise == null
                    ? "Not configured"
                    : formatInrFromPaise(shipping.free_shipping_threshold_paise)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--od-muted)]">Assembly / install note</dt>
                <dd className="mt-1">{shipping.assembly_install_note?.trim() || "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[var(--od-muted)]">Shipping settings are not configured.</p>
          )}
        </section>

        <section className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-[var(--od-text)]">Cash on Delivery</h2>
            {canManageSettings ? (
              <button type="button" className={commerceCompactButtonClass} onClick={() => setPanel({ kind: "shipping" })}>
                Manage
              </button>
            ) : null}
          </div>
          <p className="text-sm text-[var(--od-text-2)]">
            Global COD: {shipping?.cod_enabled_global ? "Enabled" : "Disabled"}
          </p>
        </section>

        <section className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-[var(--od-text)]">Delivery coverage</h2>
            {canManageSettings ? (
              <button type="button" className={commerceCompactButtonClass} onClick={() => setPanel({ kind: "pincode" })}>
                Manage Pincodes
              </button>
            ) : null}
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--od-muted)]">Serviceable pincodes</p>
              <p className="text-xl font-semibold">{serviceable}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--od-muted)]">Non-serviceable</p>
              <p className="text-xl font-semibold">{pincodes.length - serviceable}</p>
            </div>
          </div>
          <p className="mb-3 text-xs text-[var(--od-muted)]">
            Serviceability authority is pincode-level. Zone codes are display-only grouping.
          </p>
          {pincodes.length === 0 ? (
            <p className="text-sm text-[var(--od-muted)]">No pincodes configured.</p>
          ) : (
            <ul className="space-y-1 text-xs text-[var(--od-text-2)]">
              {[...groups.entries()].map(([label, count]) => (
                <li key={label}>
                  {label}: {count}
                </li>
              ))}
            </ul>
          )}
          {canManageSettings && pincodes.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {pincodes.map((row) => (
                <li key={row.pincode} className="flex items-center justify-between gap-2 text-sm text-[var(--od-text-2)]">
                  <span>
                    {row.pincode} · {row.serviceable ? "serviceable" : "not serviceable"}
                  </span>
                  <button type="button" className={commerceCompactButtonClass} onClick={() => setPanel({ kind: "pincode", row })}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
      {canManageSettings ? (
        <CommerceActionDrawer open={panel != null} title={title} onClose={() => setPanel(null)} triggerRef={triggerRef}>
          {panel?.kind === "tax" ? (
            <div className="space-y-4">
              <TaxSettingsForm settings={taxSettings} />
              <button type="button" className={commerceGoldButtonClass} onClick={() => setPanel({ kind: "tax-rate" })}>
                Add tax rate
              </button>
            </div>
          ) : null}
          {panel?.kind === "tax-rate" ? <TaxRateForm rate={panel.rate} /> : null}
          {panel?.kind === "shipping" ? <ShippingSettingsForm settings={shipping} /> : null}
          {panel?.kind === "pincode" ? <PincodeForm pincode={panel.row} /> : null}
        </CommerceActionDrawer>
      ) : null}
    </div>
  );
}
