# ADR-0028 — Phase 9D Ready-Made Furniture E-commerce Roadmap Lock

**Status:** Accepted (roadmap lock — **implementation NOT STARTED**; **no migration created**)
**Date:** August 17, 2026
**Deciders:** Business Owner, Senior Product Architect
**Technical Scope:** Category-based premium ready-made furniture storefront under `/shop`, with existing admin shell operations
**Depends on:** [ADR-0002](ADR-0002-supabase-source-of-truth.md), [ADR-0005](ADR-0005-version-1-no-erp-boundary.md), [ADR-0006](ADR-0006-public-and-admin-route-separation.md), [ADR-0007](ADR-0007-imperative-versioned-migrations.md), [ADR-0008](ADR-0008-database-backed-rbac.md), [ADR-0027](ADR-0027-phase-9a-campaign-consent-audience-approval.md)

This ADR **is** Phase 9D **roadmap and owner-lock** authority. It is **not** the Phase 9D architecture freeze. 9D-A (`PHASE_9D_ENTRY_AUDIT`) must still freeze payment provider, CRM identity reuse, inventory allocation, tax, shipping model, and RBAC codes **before** any schema.

This ADR does **not** reopen ADR-0027 / OD9A locks, Phase 9B/9C implementation, or Phase 10 production activation. Phase 9A is **COMPLETE** (PR #63 true merge). Next formal implementation is Phase 9B. Phase 9D implementation must not start until after 9C and 9D-A freeze.

Canonical sequence: **9A → 9B → 9C → 9D → 10**.

---

## Context

ONEDECORE V1 is an interior-design operating system (public site, CRM, quotations, projects, WhatsApp, consent-governed marketing). ADR-0005 / DEC-0014 exclude ERP accounting, procurement, and warehouse platforms.

The owner now locks a **later** product domain: a simple, premium, mobile-first **ready-made furniture** store. It must not become room-package interior ecommerce, a marketplace, or ERP.

No `/shop` routes, commerce tables, or payment adapters exist. Quotation payment/capability flows are **not** the commerce checkout engine; collisions are a 9D-A audit item.

---

## Decision Outcome

Owner locks OD9D-1–OD9D-12 as written in the [roadmap lock](../audits/phase-9d-ready-made-furniture-ecommerce-roadmap-lock.md).

### OD9D-1 — Category-based ready-made only

Shop by category/subcategory. **Forbidden:** Shop by Room, Shop the Look, room packages, interior packages, custom interior quotation ecommerce.

### OD9D-2 — Dynamic taxonomy

Admin-managed categories and subcategories. Initial names (Sofas, Beds, Dining, …) are examples, not a frozen enum in application code.

### OD9D-3 — Guest checkout first-class

Account is not required for MVP. Guest tracking uses Order Number + Mobile with identity match before extra PII.

### OD9D-4 — Simple variants only

Color / finish / size / upholstery. No parametric custom-size configurator, AR, or 3D.

### OD9D-5 — Supabase is commerce truth

Catalogue, inventory, cart revalidation, orders, and payment **state** live in Supabase. Browser cart totals are display-only.

### OD9D-6 — Immutable purchase snapshots

Committed order items and delivery addresses never rewrite from later catalogue or profile edits.

### OD9D-7 — COD + online; webhook is success truth

Online payment provider is **not chosen here**. Architecture must stay provider-independent. Webhook/server verification is authoritative. No secrets in the browser. No card PAN/CVV storage.

### OD9D-8 — Single-pool SKU inventory

Per sellable SKU/variant stock. Prevent silent oversell. **Not** multi-warehouse, WMS, PO, or supplier inventory. This does **not** repeal ADR-0005 warehouse ERP exclusion.

### OD9D-9 — Existing admin shell

`/admin/commerce*` inside ONEDECORE. No second admin product.

### OD9D-10 — WhatsApp is support only

Chat CTA allowed. WhatsApp is not order/payment/inventory SoR. Marketing WhatsApp remains 9A/9C governed.

### OD9D-11 — No ERP expansion

No accounting, procurement, warehouse platform, marketplace commissions, or seller dashboard.

### OD9D-12 — Phase 10 remains production gate

9D-F certifies; Phase 10 activates production.

---

## Canonical MVP flow

`/shop` → category listing → `/shop/product/[slug]` → variant → cart or Buy Now → guest checkout → COD or online payment → `OD-O-{YYYY}-{SEQ6}` → tracking.

Buy Now uses the same order engine as cart checkout.

Order lifecycle (MVP): `pending_payment`, `confirmed`, `processing`, `shipped`, `delivered`; exceptions `payment_failed`, `cancelled`.

---

## Explicit non-goals (MVP)

Room-wise commerce; marketplace; ERP/WMS/procurement; loyalty/gift cards/subscriptions; advanced returns/auto-refunds; AI recs/visual search; courier aggregator; autonomous Kriti commerce actions; mixing 9D implementation into Phase 9B/9C.

Video / 360 / AR / 3D, customer account, compare (optional defer), complex coupons — not MVP unless 9D-A explicitly pulls a subset forward.

---

## Subphase contract

| Gate | Allowed |
| :--- | :--- |
| 9D-A | Audit + architecture freeze only |
| 9D-B | Catalogue + admin |
| 9D-C | Storefront + discovery |
| 9D-D | Cart, checkout, COD orders |
| 9D-E | Online payment adapter + ops |
| 9D-F | SEO, E2E, performance, security certification |
| 10 | Production activation |

---

## Consequences

- Roadmap documents must show 9D between 9C and 10.
- No commerce migration until 9D-A freeze.
- Interior quotation ecommerce remains Phase 7, not `/shop`.
- Phase 9A MARKETING consent is not bypassed by storefront purchase or WhatsApp support chat.

---

## Related

- [Phase 9D roadmap lock](../audits/phase-9d-ready-made-furniture-ecommerce-roadmap-lock.md)
- [ADR-0005: No-ERP boundary](ADR-0005-version-1-no-erp-boundary.md)
- [ADR-0027: Phase 9A campaigns](ADR-0027-phase-9a-campaign-consent-audience-approval.md)
