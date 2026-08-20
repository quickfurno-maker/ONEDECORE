"use client";

import { useEffect, useId, useState } from "react";
import { OpsIcon } from "@/features/admin-ops/components/OpsIcon.tsx";
import type { OpsNavFlags } from "../types.ts";

interface QuickActionsMenuProps {
  readonly flags: OpsNavFlags;
}

export function QuickActionsMenu({ flags }: QuickActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const actions = [
    flags.createLead
      ? { href: "/admin/crm/leads/new", label: "New Lead" }
      : null,
    flags.crm ? { href: "/admin/crm/leads", label: "Open CRM" } : null,
    flags.quotations
      ? { href: "/admin/quotations", label: "Quotations" }
      : null,
    flags.whatsapp
      ? { href: "/admin/whatsapp/inbox", label: "Open WhatsApp" }
      : null,
    flags.commerce && !flags.commerceCatalog
      ? { href: "/admin/commerce/products", label: "Products" }
      : null,
    flags.commerceCatalog
      ? { href: "/admin/commerce/products", label: "+ Add Product" }
      : null,
    flags.commerceCatalog
      ? { href: "/admin/commerce/categories", label: "+ Add Category" }
      : null,
    flags.commerceInventory
      ? { href: "/admin/commerce/products", label: "Adjust Inventory" }
      : null,
    flags.commerceSettings
      ? { href: "/admin/commerce/settings", label: "Manage Pincodes" }
      : null,
  ].filter((item): item is { href: string; label: string } => item !== null);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--od-gold)]/50 px-3 text-sm font-medium text-[var(--od-gold)] transition hover:bg-[var(--od-gold)]/10"
      >
        Quick Actions
        <OpsIcon name="spark" className="h-4 w-4" />
      </button>
      {open ? (
        <ul
          id={menuId}
          className="absolute right-0 z-40 mt-2 min-w-48 overflow-hidden rounded-[10px] border border-[var(--od-border-strong)] bg-[var(--od-elevated)] py-1 shadow-xl"
        >
          {actions.map((action) => (
            <li key={`${action.href}:${action.label}`}>
              <a
                href={action.href}
                className="block min-h-10 px-3 py-2 text-sm text-[var(--od-text-2)] hover:bg-[var(--od-hover)] hover:text-[var(--od-text)]"
                onClick={() => setOpen(false)}
              >
                {action.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
