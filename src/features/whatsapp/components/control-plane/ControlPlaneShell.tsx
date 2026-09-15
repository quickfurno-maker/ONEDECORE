import Link from "next/link";
import type { ReactNode } from "react";
import type { WhatsappControlPlanePermissions, WhatsappControlPlaneSectionKey } from "../../contracts/control-plane.ts";
import "./control-plane.css";

/**
 * Page frame for a WhatsApp control-plane section. The workspace layout
 * renders the section nav (only what this caller can open); each page still
 * re-checks its own permission. `permissions` is kept for sections that tailor
 * their header.
 */
export function ControlPlaneShell({
  active,
  title,
  lede,
  permissions,
  children,
}: {
  readonly active: WhatsappControlPlaneSectionKey;
  readonly title: string;
  readonly lede: string;
  readonly permissions: WhatsappControlPlanePermissions;
  readonly children: ReactNode;
}) {
  void permissions;
  return (
    <div className="od-cp" data-testid={`whatsapp-${active}-workspace`}>
      <header className="od-cp__head">
        <div>
          <p className="od-cp__eyebrow">WhatsApp</p>
          <h1 className="od-cp__title">{title}</h1>
          <p className="od-cp__lede">{lede}</p>
        </div>
      </header>
      {children}
    </div>
  );
}

export function ControlPlaneDenied({ title, detail }: { readonly title: string; readonly detail: string }) {
  return (
    <section className="od-cp" aria-labelledby="whatsapp-control-plane-denied">
      <div className="od-cp__panel">
        <h1 id="whatsapp-control-plane-denied" className="od-cp__title">
          {title}
        </h1>
        <p className="od-cp__lede">{detail}</p>
        <p style={{ marginBlockStart: 16 }}>
          <Link className="od-cp__btn" href="/admin/whatsapp">
            Back to WhatsApp
          </Link>
        </p>
      </div>
    </section>
  );
}
