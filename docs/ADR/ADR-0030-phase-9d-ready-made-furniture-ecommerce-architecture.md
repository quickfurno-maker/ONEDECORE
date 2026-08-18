# ADR-0030 — Phase 9D Ready-Made Furniture E-commerce Architecture Freeze

**Status:** Accepted (9D-A architecture freeze — **docs only**; **no schema**; **no `/shop` runtime**)
**Date:** August 18, 2026
**Deciders:** Business Owner, Senior Product Architect
**Depends on:** [ADR-0028](ADR-0028-phase-9d-ready-made-furniture-ecommerce.md) (roadmap lock / OD9D-1–OD9D-12), [ADR-0002](ADR-0002-supabase-source-of-truth.md), [ADR-0005](ADR-0005-version-1-no-erp-boundary.md), [ADR-0006](ADR-0006-public-and-admin-route-separation.md), [ADR-0007](ADR-0007-imperative-versioned-migrations.md), [ADR-0008](ADR-0008-database-backed-rbac.md), [ADR-0018](ADR-0018-secure-lead-intake-data-plane.md), [ADR-0019](ADR-0019-five-role-crm-authorization-model.md), [ADR-0022](ADR-0022-v1-direct-quotation-finalization-and-send.md), [ADR-0027](ADR-0027-phase-9a-campaign-consent-audience-approval.md)

This ADR **is** the Phase 9D architecture freeze. It does **not** reopen OD9D-1–OD9D-12. It does **not** authorize 9D-B implementation, any commerce migration, managed writes, payment SDKs, or Phase 10 activation.

**9D-B remains blocked** until Phase 9C is complete **and** this freeze is merged.

Commerce migration timestamps are **intentionally unreserved**. 9D-B must take the next available repository timestamp from then-current main after 9C. Do **not** call a future commerce migration M33 from this document.

---

## 1. Context

Repository entry audit (2026-08-18, main `39f5a7a69998418bee943168cff218a0aa1f721e`):

- Public routes exist for homepage, `/portfolio`, legal, `/lp/[slug]` (Landing Lab), `/q/[token]` (quotation acceptance). **No `/shop`.**
- Admin shell exists; nav has no commerce item. **No `/admin/commerce*`.**
- `src/proxy.ts` matches `/admin`, `/auth`, `/lp` only. Shop must be added later without weakening admin auth.
- Sitemap is homepage + portfolio only. Robots disallow `/admin/`, `/api/admin/`, `/auth/`.
- No Razorpay/Stripe/Cashfree/PhonePe/PayU packages or adapters.
- Quotation **payment schedules** are commercial milestone percentages/amounts, not a PSP. WhatsApp webhooks are Meta messaging evidence, not commerce payments.
- `quotation_tax_profiles` is quotation GST-rate catalogue. Projects materialize only from Closed-Won interior leads (Phase 8A).
- Contacts/leads/consent remain interior CRM/intake truth. Purchase must not fabricate MARKETING or auto-create interior leads.
- Portfolio storage is `portfolio-originals` (private, 20 MiB JPEG/PNG/WebP) + `portfolio-public` (public derivatives). Quotation/design/execution buckets are private staff documents.
- Idempotency / `OD-{DOMAIN}-{YYYY}-{SEQ6}` / SA+SM permission grants / SECURITY DEFINER `search_path=''` patterns exist and must be reused conceptually, not mixed into quotation or landing-lab ledgers.

Collisions are **naming and boundary**, not existing commerce tables. Architecture must keep commerce SoR separate from quotation, project, WhatsApp, and campaign execution.

---

## 2. Provider boundary (OD9D-7)

### 2.1 Interface (provider-independent)

Server-only port `CommercePaymentProvider`:

- `createCheckoutSession({ orderId, amountPaise, currency, receipt, customer, returnUrls })`
- `parseAndVerifyWebhook({ rawBody, headers, secret })` → `{ providerEventId, providerPaymentId, status, amountPaise, currency, signatureValid }`
- `fetchPayment(providerPaymentId)` (server reconciliation)

No provider SDK types leak into order/inventory domain. HTTPS + HMAC verification in a thin adapter. **Do not install a payment SDK in 9D-A.** 9D-E may add one adapter package if required; domain still talks to the port.

### 2.2 Initial Indian provider (recommendation, not exclusive lock)

**Razorpay** as the first adapter: India UPI / cards / netbanking / wallets, Orders + Payments + webhooks, INR paise, receipt mapping to `OD-O-*`. Architecture remains provider-independent so Cashfree/PhonePe can replace the adapter later.

MVP online methods: UPI, card, netbanking, wallet as the provider enables. No EMI/BNPL/subscriptions for MVP.

### 2.3 Sequence

1. Server revalidates cart (published product/variant, price, tax, shipping, COD eligibility, stock).
2. Create order `pending_payment` (online) or `confirmed` (COD) atomically with inventory (see §4).
3. Online: create provider order/session with **exact** `amount_paise` and `INR`; store provider refs on `commerce_payments`.
4. Browser redirect/checkout UX is **not** success.
5. Webhook (or verified server fetch) with signature, amount, currency, and order binding is **paid** truth. If the 15-minute hold has already expired, apply §4.3 (fresh stock commit or `cancelled` + `paid`, never oversell).
6. Idempotent apply by `provider_event_id` / payment id.

If step 3 **fails before the customer pays**, release the inventory hold **immediately** (§4.2).

### 2.4 Webhook / secrets

- Signature verified constant-time; fail closed.
- Replay: unique provider event id in append-only evidence table (or unique payment event ledger). Duplicate delivery replays stored outcome.
- Amount and currency must match order snapshot.
- Secrets: server env only. No PAN/CVV. No browser service role.
- Failure **before pay** (session never created, or unpaid timeout): payment `failed` or `cancelled`; order `payment_failed`/`cancelled` if still unpaid; inventory hold released **immediately** if no session, or at TTL if unpaid.
- Failure **after money received** with no stock: payment stays `paid`; order `cancelled` + manual refund flag (§4.3). Never `payment_failed` for a paid capture.

Refunds: **manual ops / post-MVP**. No automatic refund engine in 9D-E. Optional `refunded` payment status may be added later without changing order snapshot immutability.

---

## 3. CRM identity reuse (OD9D-3)

Furniture purchase is **not** an interior enquiry.

| Rule | Freeze |
| :--- | :--- |
| Lead required to buy | **No** |
| Auto-create interior lead on purchase | **No** (MVP). Lead only if the customer later submits `/api/public/lead-intake` or staff creates a CRM lead |
| Auto Closed-Won / project from furniture order | **Forbidden** |
| MARKETING from purchase | **Forbidden** |
| Transactional updates (order SMS/email/WhatsApp) | Distinct from MARKETING; service/order communication copy; not `consent_events` MARKETING grant |
| Order identity | Immutable snapshot: name, mobile E.164, optional email, delivery address as entered |
| Contact linkage | **Optional secondary** after commit |

Contact reuse (safe MVP):

- Normalize mobile with existing `normalisePhoneToE164` (India `+91`).
- If an **active** `contacts` row matches that E.164, staff/RPC **may** set `commerce_orders.contact_id` (nullable FK). Do not merge emails as identity (intake already never auto-merges on email).
- If no contact: **do not require** creating one at checkout. Optional post-commit `ensure_commerce_contact` may create a contact with **no lead**, **no MARKETING**, channels from snapshot only — 9D-D may skip contact creation entirely if linkage is staff-only.
- Duplicate contacts: follow existing CRM duplicate-safe rules; never expose other customers’ orders.
- Guest tracking: Order Number + Mobile match **before** extra PII. Match is proven by a short-lived server-issued tracking cookie (see §10.1 / §14); the URL `orderReference` alone never authorizes PII.

---

## 4. Inventory (OD9D-8)

Single pool per sellable variant/SKU. **Not** WMS.

### 4.1 Semantics

- `stock_on_hand` integer ≥ 0 (physical/available sellable units in the storefront pool).
- `reserved_qty` integer ≥ 0 (online unpaid holds).
- `available_qty` generated/computed: `stock_on_hand - reserved_qty`.
- Made-to-order: `availability_mode = ready_stock | made_to_order`. Made-to-order **does not decrement** storefront stock; it still records the order. COD/online still create orders. Oversell protection applies only to `ready_stock`.

### 4.2 Allocation

- **COD commit:** in one SECURITY DEFINER RPC, lock variant row, require `available_qty >= qty`, decrement `stock_on_hand`, insert order `confirmed`. No hold table required for COD.
- **Online checkout:** same lock; increment `reserved_qty` (not yet decrementing `stock_on_hand`); order `pending_payment`; store `inventory_hold_expires_at` = now + **15 minutes**.
- **Provider session/checkout creation failure** (adapter error **before** the customer pays): **release the hold immediately** (`reserved_qty -= qty`); do **not** wait for TTL. Order → `payment_failed` or `cancelled` per §12; append evidence. Inventory must not stay reserved if no provider session exists.
- Advisory/xact lock + row lock on variant; private commerce idempotency ledger (do **not** reuse `landing_lab_idempotency_requests` or `marketing_idempotency_requests`).

No silent oversell. No warehouse bins. No supplier PO.

### 4.3 Online paid webhook (including late payment after hold expiry)

Webhook processing is **idempotent and replay-safe** (unique provider event id). Browser redirect is never `paid`.

**Before `inventory_hold_expires_at` (active hold still assumed):**

A signature-verified paid webhook **atomically converts the existing hold**: `reserved_qty -= qty`, `stock_on_hand -= qty`, payment = `paid`, order = `confirmed`. Do not convert a hold that has already been released.

**After expiry, the original hold is no longer assumed to exist** (TTL or explicit release already decremented `reserved_qty`). A verified **late** paid webhook must **not** convert the old reservation. It must:

1. Lock required inventory rows.
2. Attempt a **fresh atomic stock commit** against **current** `available_qty`.

**If all required `ready_stock` qty is still available:**

- decrement `stock_on_hand` atomically (do not assume leftover `reserved_qty`);
- payment remains / becomes `paid`;
- order → `confirmed`;
- append-only event `late_payment_recovered`.

**If stock is NOT available:**

- **never oversell**; never underflow `reserved_qty` / `stock_on_hand`;
- payment remains authoritative **`paid`** (money was received — **do not** set `payment_failed`);
- order must **not** become `confirmed`;
- order → `cancelled` with `cancellation_reason_code = paid_after_hold_expiry_stock_unavailable`;
- append an immutable `manual_action_required` (or equivalent) event;
- flag the order/payment for **manual refund resolution**.

No automatic refund engine in MVP. Made-to-order lines do not compete for storefront `stock_on_hand`; late-pay recovery for those lines confirms without a stock decrement.

TTL expiry without a paid webhook: release reservation; order may remain `pending_payment` until staff/timeout policy moves it to `payment_failed`/`cancelled` **only if unpaid**. After `confirmed`, staff cancel restocks `stock_on_hand` via RPC only.

---

## 5. Tax

Do **not** reuse `quotation_tax_profiles` as commerce SoR (quotation commercial GST on interior bills).

- Display: **GST-inclusive** selling prices (Indian furniture retail MVP).
- Authority: server computes tax **in paise** from inclusive unit price × qty using product/HSN tax rate snapshot.
- Product metadata: optional HSN/SAC code + tax rate id. Line snapshot stores rate, HSN, tax paise, taxable paise, inclusive line total.
- Rounding: round half-up to integer paise on line; order tax total = sum of line tax paise (no browser totals).
- Settings: `commerce_tax_settings` / `commerce_tax_rates` are **explicit Super Admin / `commerce.settings.manage` configuration**. Architecture does **not** seed or assume any statutory GST percentage. Rates used in production must be verified and configured at implementation/activation time.
- Product **publication** and **checkout** **fail closed** if a required tax rate is missing or inactive. No accounting / GST filing ERP.

---

## 6. Shipping / pincode

No courier aggregator.

- `commerce_pincodes`: 6-digit pincode, `serviceable`, optional `zone_code`, `eta_min_days` / `eta_max_days`.
- `commerce_shipping_settings`: default charge paise, free-shipping threshold paise, COD enabled global flag.
- Overrides: product and/or category shipping charge / COD allow / free-ship eligibility.
- Checkout fails closed if pincode not serviceable.
- Order snapshot copies: serviceable flag, charge paise, eta, assembly/install note text.

MVP operable as Pune-first allowlist plus later India expansion via admin pincodes. PDP checker uses the same tables (read RPC / server).

---

## 7. RBAC

Canonical codes (system permissions, 9D-B insert):

| Code | Purpose |
| :--- | :--- |
| `commerce.read` | Read catalogue/orders/settings (non-secret) |
| `commerce.catalog.manage` | Categories, products, variants, media, publish/archive |
| `commerce.inventory.manage` | Stock adjustments |
| `commerce.orders.manage` | Fulfilment transitions, cancel, tracking ref |
| `commerce.payments.read` | Inspect payment state (no secret/PAN) |
| `commerce.settings.manage` | Tax, shipping, COD, pincodes |

Grants:

| Role | Permissions |
| :--- | :--- |
| `super_admin` | All six |
| `sales_manager` | `commerce.read`, `commerce.orders.manage`, `commerce.payments.read` |
| `sales_executive`, `project_manager`, `designer`, legacy ops | **None** |

Sales Manager does **not** get catalogue/inventory/settings merely because they manage CRM. Nav: `commerce.read`. Mutations via RPCs; anon denied; authenticated direct writes denied.

---

## 8. Product media

Dedicated buckets (do **not** reuse portfolio or quotation buckets):

- `commerce-product-originals` — private; JPEG/PNG/WebP; 20 MiB (match current originals limit).
- `commerce-product-public` — public derivatives; 8 MiB.

Object key prefix: `{product_id}/{media_id}/…`. Staff upload via service-role after permissioned RPC preauthorization (same idea as design evidence). Public PDP uses derivative URLs only.

`commerce_product_media`: sort_order, `is_primary`, optional `variant_id`, alt text, archive (no hard-delete of media referenced by order snapshots). Order lines store **immutable** public image URL or storage path snapshot at commit.

No video / 360 / AR.

---

## 9. Coupons / compare / wishlist

| Feature | MVP |
| :--- | :--- |
| Coupons | **DEFER** (post-MVP). Checkout has no coupon field in 9D-D. |
| Product compare | **DEFER**. |
| Wishlist | Browser-local; never reserves stock. Signed-in sync post-MVP. |
| Recently viewed | Browser-local. |

---

## 10. Canonical routes

**Public**

| Route | Role |
| :--- | :--- |
| `/shop` | Category hub / featured |
| `/shop/c/[slug]` | Category or subcategory listing (nested slug unique) |
| `/shop/product/[slug]` | PDP |
| `/shop/search` | Search |
| `/shop/cart` | Cart UI (client cart) |
| `/shop/checkout` | Guest checkout |
| `/shop/track` | Guest Order Number + Mobile **form** (POST / server action) |
| `/shop/order/[orderReference]` | Status **only after** valid tracking proof (see §10.1) |

Do **not** use `/consultation` for commerce. Do **not** put shop under `/portfolio`.

### 10.1 Guest tracking proof (required)

The path `/shop/order/[orderReference]` **never** authorizes access by `orderReference` alone. Raw mobile **must not** appear in the URL or query string. Browser localStorage/sessionStorage is **not** authority.

Lean MVP:

1. Guest submits **POST** `/shop/track` (or equivalent server action / API) with order reference + mobile.
2. Server rate-limits; normalizes mobile with `normalisePhoneToE164`; performs a **non-enumerating** combined order+mobile check. Individual existence of order vs mobile is never revealed (same 404-equivalent on miss).
3. On match, server issues a **short-lived signed tracking context** (HMAC, server-only secret): `order_reference`, `issued_at`, `expires_at`, optional nonce/version. **Do not** put raw phone in the token unless strictly required (MVP: omit phone).
4. Store proof in an **HttpOnly**, **SameSite=Lax**, **Secure** in production cookie, path-scoped as narrowly as practical to `/shop/order`. Lifetime **15 minutes** (within 10–30; not a long-lived guest session).
5. `/shop/order/[orderReference]` validates the cookie **server-side**: signature, expiry, and `order_reference` **must equal** the route param. Invalid/missing/mismatch → non-enumerating `notFound()` / 404-equivalent. **No PII** before successful proof.
6. Tracking proof is **not** customer authentication and creates **no account**.

An opaque server-side token with the same properties is acceptable; HMAC cookie is the default freeze.

**Admin** (existing shell)

| Route | Role |
| :--- | :--- |
| `/admin/commerce` | Overview |
| `/admin/commerce/categories` | Taxonomy |
| `/admin/commerce/products` | List |
| `/admin/commerce/products/[id]` | Edit |
| `/admin/commerce/orders` | List |
| `/admin/commerce/orders/[id]` | Detail + fulfilment |
| `/admin/commerce/settings` | Tax, shipping, COD, pincodes |

Payments are a panel on the order detail, not a separate product. Proxy must include `/shop/:path*` later for cookies if needed **without** `updateSession` cost if unauthenticated (pattern: `/lp`). Guest cart does not require auth cookies.

---

## 11. Conceptual schema (NO SQL in 9D-A)

All public tables: UUID PK, RLS on, revoke anon writes, mutations via RPCs. Hard-delete of historical identity/orders forbidden for ordinary roles.

| Concept | Authority | Mutable | Notes |
| :--- | :--- | :--- | :--- |
| `commerce_categories` | Admin taxonomy | Yes until archived | Nested parent; unique slug; SEO fields |
| `commerce_products` | Catalogue | Draft/published/archived | `OD-P-{YYYY}-{SEQ6}`; no hard delete if ordered |
| `commerce_product_variants` | SKU | Yes until ordered history exists | Options JSON bounded; SKU unique |
| `commerce_product_media` | Media | Archive | See §8 |
| `commerce_product_specifications` | K/V specs | Yes | Admin |
| `commerce_inventory` | Stock | Via inventory RPC | 1:1 variant; §4 |
| `commerce_related_products` | Manual related | Yes | No AI |
| `commerce_pincodes` / `commerce_shipping_settings` | Shipping | Yes | §6 |
| `commerce_tax_rates` / `commerce_tax_settings` | Tax | Yes | §5 |
| `commerce_orders` | Order | Lifecycle only | `OD-O-{YYYY}-{SEQ6}`; snapshots immutable; `inventory_hold_expires_at` for pending online; `cancellation_reason_code` nullable |
| `commerce_order_items` | Lines | Immutable after insert | |
| `commerce_order_delivery` | Address snapshot | Immutable after insert | |
| `commerce_payments` | Payment | Provider-driven | Separate from order status |
| `commerce_payment_events` | Webhook evidence | Append-only | |
| `commerce_order_events` | History | Append-only | |
| `private.commerce_idempotency_requests` | Mutations | Ledger | Actor + op + key + hash |
| `private.commerce_order_reference_seq` | Refs | Sequence | Asia/Kolkata year |

**No cart table** in MVP. Guest cart is client-local; server revalidates at checkout.

**No** marketplace, warehouse, procurement, ledger, or customer-account tables. Optional `contact_id` on orders only.

Indexes (intent): unique slugs, unique SKU, unique order reference, inventory variant PK, payment provider event unique, guest lookup `(order_reference)` not phone-enumerable.

---

## 12. Order and payment states

**Order** (mutually exclusive):

```
COD:              → confirmed → processing → shipped → delivered
Online: pending_payment → confirmed → processing → shipped → delivered
Exceptions: payment_failed | cancelled
```

- COD **starts `confirmed`** after successful stock commit (no `pending_payment`).
- `pending_payment` → `confirmed` only via verified **paid** webhook **and** a successful stock conversion or late-pay restock commit (§4.3).
- `pending_payment` → `payment_failed` or `cancelled` when **unpaid** (hold release): TTL without pay; provider session never created; customer abandon. **Not** used when money was received.
- **Paid + stock unavailable after hold expiry:** order → `cancelled` (`paid_after_hold_expiry_stock_unavailable`); payment stays **`paid`**; manual refund flag. Do **not** invent `payment_failed`.
- `cancelled` from `confirmed`/`processing` via staff RPC + restock; not from `shipped`/`delivered` in MVP (support/manual).
- `delivered` terminal success. No project conversion.

**Payment** (separate): `created` → `pending` → `paid` | `failed` | `cancelled`.

`paid` and order `cancelled` **may coexist** for the late-pay / stock-unavailable case. Do not store card data. Do not treat browser redirect as `paid`.

---

## 13. Order reference and snapshots

- PK UUID; human `OD-O-{YYYY}-{SEQ6}` (Asia/Kolkata year; race-safe private sequence; immutable).
- Item snapshot: product/variant ids + refs, name, SKU, option labels, primary image ref/URL, MRP paise, selling paise, discount paise, tax rate/code/value paise, qty, line total paise.
- Delivery snapshot: name, mobile E.164, email optional, lines of address, locality, city, state, pincode.
- Customer snapshot on order header as entered.
- Catalogue/price/stock edits never UPDATE these rows.

---

## 14. Security / privacy

- No browser service role; no browser-authoritative price/stock/tax/shipping.
- RLS on all public commerce tables; guest tracking returns 404-equivalent without a **combined** order+mobile match; rate-limit track + checkout + webhook.
- Guest tracking proof: HMAC (or opaque) **HttpOnly** cookie; secret server-only; 15-minute expiry; route reference must match token; **no raw mobile in URL/query**; URL `orderReference` alone never authorizes PII (§10.1).
- Webhook route: raw body signature verify; **idempotent / replay-safe**; late-pay must not convert a released hold (§4.3).
- Purchase ≠ MARKETING. WhatsApp CTA ≠ order SoR (OD9D-10).
- `/shop/order/[orderReference]` must not list or increment-guess PII.

---

## 15. SEO / analytics

- Canonical `/shop/c/[slug]` and `/shop/product/[slug]`.
- Product JSON-LD: name, SKU, price, `INR`, availability, image, variant.
- Archived/unpublished: `noindex`. Variants canonicalize to product slug unless a variant has its own public slug (MVP: **product slug only**).
- Sitemap: add published categories/products in 9D-C/F; never guest track URLs.
- Analytics event names (not SoR): `product_view`, `category_view`, `search`, `add_to_wishlist`, `add_to_cart`, `remove_from_cart`, `begin_checkout`, `purchase`.
- Do not bind architecture to Meta/Google pixels (Phase 9C is campaign execution, not shop analytics).

---

## 16. Subphase gates

| Gate | Entry | Exit (required) | Forbidden |
| :--- | :--- | :--- | :--- |
| **9D-A** | ADR-0028 locked | This ADR merged | Schema, `/shop` code, SDKs |
| **9D-B** | 9C complete **and** 9D-A merged | Catalogue tables, RBAC, admin CRUD, storage, inventory RPC, pgTAP | Checkout, payments, public `/shop` mutation |
| **9D-C** | 9D-B | `/shop` browse/PDP/search, SEO draft, local wishlist | Order insert, payments |
| **9D-D** | 9D-C | Cart revalidate, guest checkout, COD, snapshots, track, oversell tests | Provider adapter |
| **9D-E** | 9D-D | Razorpay (or successor) adapter, webhook, payment states, admin payment read | Auto-refunds, ERP |
| **9D-F** | 9D-E | SEO/E2E/concurrency/webhook/a11y/mobile QA | Production secrets in Git |
| **10** | 9D-F | Owner production activation | — |

---

## 17. Consequences

- Interior quotations, projects, Landing Lab, and campaigns remain separate SoRs.
- 9D-B allocates the next migration filename at implementation time.
- Phase 10 still activates production `/shop` and payment keys.

---

## Related

- [9D-A entry audit](../audits/phase-9d-a-ecommerce-entry-audit-architecture-freeze.md)
- [ADR-0028 roadmap lock](ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- DEC-0079, DEC-0083
