# Phase 9D-A — Ready-Made Furniture E-commerce Entry Audit + Architecture Freeze

**Date:** 2026-08-18  
**Starting main:** `39f5a7a69998418bee943168cff218a0aa1f721e` (PR #66 merge)  
**Branch / worktree:** `phase-9d-a-commerce-entry-audit` / `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase9d-a`  
**Authority:** ADR-0028 / ADR-0030 / DEC-0079 / DEC-0083 / OD9D-1–OD9D-12  
**Scope:** docs only. No schema, no `/shop` runtime, no payment SDK, no managed write.

---

## 1. Sequence (unchanged)

`9A COMPLETE → 9B repository merged (managed M32 pending) → 9C NOT STARTED → 9D implementation (blocked) → 10`

9D-B must not start until **Phase 9C complete** and **this freeze merged**.

---

## 2. Repository evidence (collisions)

| Area | Finding | Freeze |
| :--- | :--- | :--- |
| Public `src/app` | Home, `/portfolio`, legal, `/lp/[slug]`, `/q/[token]`. **No `/shop`.** | New `/shop*` only in 9D-C+ |
| Admin | Shell nav: portfolio, staff, attendance, leave, CRM, quotations, projects, campaigns, landing-pages, WhatsApp. **No commerce.** | `/admin/commerce*` + `commerce.read` nav |
| Proxy | Matcher `/admin`, `/auth`, `/lp` | Later add `/shop` without weakening admin `updateSession` |
| Sitemap | Home + portfolio | Add published shop URLs in 9D-C/F; never `/shop/track` |
| Robots | Disallow `/admin/`, `/api/admin/`, `/auth/` | Keep; unpublished products noindex |
| Payment packages | No Razorpay/Stripe/Cashfree/PhonePe/PayU in `package.json` / `src` | Adapter in 9D-E only |
| Quotation “payment” | `quotation_payment_schedules` = milestone %/amount | **Not** PSP; commerce `commerce_payments` is separate |
| WhatsApp webhooks | Meta message/status evidence | **Not** commerce payment webhooks |
| Tax | `quotation_tax_profiles.rate_percentage`; tax in paise on quotation versions | Dedicated commerce tax tables; GST-inclusive display |
| Projects | Closed-Won + accepted quotation only (8A) | Furniture order **never** creates a project |
| CRM | contacts/leads/`consent_events`; phone E.164 helper exists | Optional contact link; **no** auto lead; **no** MARKETING from purchase |
| Storage | `portfolio-originals` / `portfolio-public`; private quotation/design/execution buckets | Dedicated `commerce-product-*` buckets |
| RBAC | Dotted codes; SA/SM grants for marketing/landing | Six `commerce.*` codes; SE/PM/Designer none |
| Idempotency | Private ledgers per domain (intake, marketing, landing lab, quotations) | New `private.commerce_idempotency_requests` |
| References | `OD-C-*`, `OD-LP-*`, `OD-LP-PUB-*`, `OD-LP-EXP-*` | `OD-O-*` orders, `OD-P-*` products |
| Search/filter | Portfolio listing only | Shop search is 9D-C DB-backed, not vector |
| Tests/CI | `test:app`, pgTAP `01_`–`24_`, migration count ledgers | 9D-B adds pgTAP + ledger bump; **do not reserve M33 now** |

No existing `/admin/commerce` placeholder, no commerce tables, no `src/features/commerce`.

---

## 3. Frozen 9D-A decisions (summary)

Full normative text: [ADR-0030](../ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md).

| Topic | Freeze |
| :--- | :--- |
| Payment | Provider-independent port; **Razorpay first adapter**; webhook = online success; no PAN/CVV |
| CRM | No lead required; no auto interior lead; optional contact by E.164; purchase ≠ MARKETING |
| Inventory | `stock_on_hand` / `reserved_qty`; COD decrements on confirm; online 15-minute reserve; row locks |
| Tax | Commerce-owned rates; GST-inclusive prices; paise on server; not `quotation_tax_profiles` |
| Shipping | Pincode allowlist + default charge + free threshold + product/category override; no aggregator |
| RBAC | Six `commerce.*` codes; SA all; SM read/orders/payments.read only |
| Media | Dedicated originals + public derivatives |
| Coupons | **DEFER** |
| Compare | **DEFER** |
| Wishlist / recent | Browser-local; no stock reserve |

---

## 4. Routes / schema / states

See ADR-0030 §§10–12. Guest cart is **not** a DB table. COD orders start **`confirmed`**. Online orders start **`pending_payment`**.

---

## 5. Migration sequencing

Phase 9B already occupies repository **M32**. Phase 9C may add one or more migrations. 9D-A **does not** create or reserve a timestamp. 9D-B uses **NEXT-AVAILABLE-FOR-9D-B** on then-current main. Do not name it M33 in this freeze.

---

## 6. Production / parallel work

- Landing Lab public gate remains OFF.
- Managed M32 apply remains a **separate** recovery gate.
- Phase 9C not started.
- No deployment, no payment execution, no `/shop` implementation in this PR.

Protected stashes (original worktree, untouched): `phase-9d-roadmap-lock-pending-after-pr63`, `pre-phase-5c local residue 2026-07-31`.

---

## 7. Owner questions

None. All deferred 9D-A items are frozen to lean MVP defaults from repository evidence (Razorpay as first adapter is a **recommendation inside a provider-independent port**, not an exclusive forever lock).
