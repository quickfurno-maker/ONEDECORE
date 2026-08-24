# ADR-0033 — Phase 9D COD-First Launch and Online Payment Deferral

**Status:** Accepted (docs-only sequencing amendment; **no runtime**; **no migration**; **no managed write**; **production OFF**)  
**Date:** August 24, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Depends on:** [ADR-0028](ADR-0028-phase-9d-ready-made-furniture-ecommerce.md), [ADR-0030](ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md), [ADR-0032](ADR-0032-commerce-admin-control-and-phase-9d-c-storefront-preparation.md)  
**Decision register:** [DEC-0094](../10-decision-register.md)  
**Audit:** [COD-first governance amendment](../audits/phase-9d-cod-first-launch-governance-amendment.md)

This ADR is an **owner-approved launch sequencing amendment**. It does **not** erase ADR-0028 / ADR-0030 payment architecture, inventory-hold design, provider-independent port, or webhook-truth rules. Those remain the online-payment design when that capability is resumed.

**Baseline at acceptance:** protected `main` `f40089b9eb82c9e023365a9dca2cafecde0d54a2` (PR #85 merge — Phase 9D-D2). Repository migrations **M1–M37**. **M38 absent** from `main`. Production **OFF**.

---

## 1. Context

ONEDECORE furniture-shop MVP can launch faster as **COD-first / COD-only** using the merged D2 guest COD cart/checkout/tracking path. Online payment (Phase 9D-E) is valuable but not required for initial shop launch.

Local Phase 9D-E work exists on branch `phase-9d-e-online-payments` at `b2ea05c243d03d3e88385189b8a7098a8ffe20c8` (including deferred migration `20260825140000_commerce_online_payment_adapter_foundation.sql`). That work is **intentionally not on `main`**, **not managed-applied**, and **not authorized for live charges**.

---

## 2. Decision

### A. Initial launch scope

- Furniture-shop MVP launch payment method is **COD only**.
- Merged D2 COD checkout/tracking/admin orders on `main` are the launch checkout path.
- Online payment is **not** required for initial shop launch.

### B. Phase 9D-E status

- Phase 9D-E online payment implementation is **DEFERRED**.
- Preserved local head `b2ea05c…` is **non-main, non-managed evidence only**.
- It is **not** current production or repository-`main` truth.
- **M38 remains absent** from `main` and managed OneDecore under this amendment.
- No Razorpay credentials, webhook registration, or live charge are required for COD launch.

### C. Sequencing amendment (launch path only)

Original ADR-0030 gate table required:

`9D-D → 9D-E → 9D-F → 10`

**Amended launch sequence:**

`9D-D → 9D-F (COD certification) → 10 (COD-only activation)`

9D-E may resume later as an **independent deferred payment capability**:

`then-current main → rebase/port preserved 9D-E → recertify → managed apply (renumber if needed) → provider test-mode → separate online-payment activation`

### D. Phase 10

- After 9D-F COD certification, Phase 10 may activate the **COD-only** public storefront.
- Phase 10 COD activation **MUST NOT** activate online payments, provider secrets, webhook registration, or live provider traffic.
- Online-payment activation requires **separate explicit owner authorization** after 9D-E is completed and certified.

### E. Architecture preservation (no weakening)

Retain ADR-0030 / ADR-0028 invariants:

- Supabase commerce truth
- Server-authoritative pricing
- Immutable order snapshots
- Stock / oversell protection
- Guest tracking proof
- Admin RBAC (`commerce.*`)
- No CRM marketing side effects from furniture purchase
- No ERP / WMS / procurement
- No fake online-payment status
- No automatic refunds

### F. Resume safety for online payments

When 9D-E resumes:

1. Do **not** blindly merge the old payment branch.
2. Rebase/port against then-current `main`.
3. Audit migration-number collision; if conceptual M38 was consumed, renumber the deferred payment migration **forward-only** before any managed apply.
4. Rerun all current commerce regressions and payment-specific gates.
5. Use provider **test mode** before any live activation.

---

## 3. Consequences

- Next formal implementation after this docs gate merges: **Phase 9D-F COD-only certification/hardening**.
- Online payments remain designed (ADR-0030) but **out of launch-critical path**.
- This ADR authorizes **no** runtime, migration, managed write, push, or production activation by itself.

---

## 4. Related

- [ADR-0030 §16 gates](ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md) — original sequence; launch path amended here
- [Phase 9D-D2 audit](../audits/phase-9d-d2-cart-checkout-tracking-implementation.md)
- [Roadmap](../09-phase-roadmap.md) · [Project truth](../00-project-truth.md)
