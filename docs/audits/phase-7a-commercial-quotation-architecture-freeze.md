# ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation Entry Audit & Architecture Contract Freeze

**Document Status:** Locked Architecture Freeze & Entry Audit  
**Date:** August 11, 2026  
**Repository Baseline:** Protected `main` commit `eb524d166e09b3160526ff5d0c642a1a65012f88` (PR #51 merged)  
**Managed Baseline:** Supabase project `lpurlfmpvriyvpkujvyl` (`ap-south-1`) aligned M1–M24  
**Current Phase:** Phase 7A — Commercial Quotation Data & Draft Foundation (**ENTRY AUDIT & ARCHITECTURE FREEZE ONLY**)  

---

## 1. Repository & Managed Baseline Verification

| Metric / Item | Status / Value | Verification Evidence |
| :--- | :--- | :--- |
| Worktree Path | `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase6c` | `pwd` confirmed |
| Architecture Branch | `phase-7a-quotation-architecture-freeze` | Created clean from `origin/main` |
| `origin/main` SHA | `eb524d166e09b3160526ff5d0c642a1a65012f88` | `git rev-parse origin/main` |
| PR #51 Head Containment | `d60fe018fa1b026003410b062e1a40a31a478959` | Contained in `origin/main` |
| Repository Migrations | `24` files (`M1–M24`) | `supabase/migrations/*.sql` |
| Latest Migration | `20260811140000_staff_attendance_idempotency_repair.sql` | M24 verified |
| M25 Status | **ABSENT** (Conceptually reserved; NOT created) | File system check confirmed |
| Managed Alignment | `24` migrations (`M1–M24`) | `npx supabase migration list --linked` |
| Working Tree Status | CLEAN (Docs updates only for Phase 7A freeze) | `git status` confirmed |

---

## 2. Governing Business Rules & Contradiction Audit

### 2.1 Locked Commercial Decisions (DEC-0056 & ADR-0022)
1. **NO Internal Approval Workflow in V1:**
   - **NO** `Submitted for Approval` status.
   - **NO** `Approved` quotation state.
   - **NO** `quotations.approve` system permission.
   - **NO** `quotation_approvals` or `quotation_approval_policies` tables.
   - **NO** maker-checker approval requirement.
   - Assigned Sales Executive can create, edit, finalize (in 7B), and send (in 7B) quotations for their own assigned leads.
2. **Canonical Achievement Basis:**
   - **`taxable_base_paise`** (post-discount, pre-tax) is the sole achievement basis for sales performance (DEC-0056).
   - **GST/tax MUST NOT inflate sales achievement.**
   - Customer grand total payable: `grand_total_paise = taxable_base_paise + tax_total_paise`.
3. **Closed-Won Invariant (ADR-0020):**
   - Requires an authoritative `Accepted` quotation (Phase 7B / 8A).
   - Phase 7A MUST NOT create projects, update lead lifecycle to Closed-Won, or activate sales targets.
4. **Outbound Channel Boundary (ADR-0021 & Phase 6B):**
   - Future Phase 7B delivery must pass through Phase 6B `WHATSAPP_SERVICE` boundary.
   - No direct Meta Cloud API send path inside quotation domain.

---

## 3. Scope Boundary: Phase 7A vs Phase 7B

### 3.1 Phase 7A Scope (Inclusions)
- **Quotation Root Identity:** `quotations` table linked to `leads` (`lead_id`).
- **Version Management:** `quotation_versions` table with monotonic `version_number`.
- **One Mutable Draft Invariant:** Only one active draft version allowed per quotation at any time.
- **Section / Room Structure:** `quotation_sections` table for layout grouping (e.g. Living Room, Master Bedroom, Kitchen).
- **Line Item Details:** `quotation_items` table (description, specifications, quantity, unit rate, canonical line subtotal).
- **Draft Payment Schedule:** `quotation_payment_schedules` milestone breakdown.
- **Header & Terms Snapshots:** Inclusions, exclusions, terms & conditions, client address / property snapshot structure.
- **Canonical Money Arithmetic:** Server/DB integer paise calculations (`subtotal_paise`, `discount_paise`, `taxable_base_paise`, `tax_total_paise`, `grand_total_paise`).
- **Quotation-Level Discount Only:** Single discount per draft version. No line-item discounts.
- **RLS & Authorization:** Five-role model integration; Sales Executive assigned-lead scope; Manager/Admin broad scope; PM/Designer ZERO mutation scope.

### 3.2 Phase 7B / 8A / 10 Exclusions (Strictly Prohibited in 7A)
- ❌ **Quotation Finalization Runtime:** (`finalize_quotation_version` RPC / state transition belongs to 7B).
- ❌ **PDF Generation & Storage:** (No PDF engine, templates, or bucket uploads in 7A).
- ❌ **WhatsApp / Delivery Runtime:** (No `send_quotation` RPC or WhatsApp dispatch in 7A).
- ❌ **Public / Client Access:** (No public quotation viewing link, tokens, or customer portal in 7A).
- ❌ **Client Acceptance / Rejection:** (No client accept/reject token, e-signature, or response tracking in 7A).
- ❌ **Closed-Won Project Conversion:** (No project creation or Closed-Won status mutation in 7A).
- ❌ **Sales Achievement Activation:** (Commercial target achievement remains inactive in 7A).
- ❌ **Migration M25 Creation / Apply:** (M25 reserved conceptually; zero DB schema writes in 7A turn).

---

## 4. Quotation Relational Data Model (Conceptual Design for M25)

```
                       ┌─────────────────────────┐
                       │      public.leads       │
                       └────────────┬────────────┘
                                    │ 1
                                    │
                                    │ 1..*
                       ┌────────────▼────────────┐
                       │    public.quotations    │ (Root Identity)
                       └────────────┬────────────┘
                                    │ 1
                                    │
                                    │ 1..*
                       ┌────────────▼────────────┐
                       │ public.quotation_versions│ (Versions & Monotonic Numbers)
                       └──────┬───────────┬──────┘
                              │           │
                     1..*     │           │     1..*
          ┌───────────────────┘           └───────────────────┐
          │                                                   │
┌─────────▼───────────┐                             ┌─────────▼───────────┐
│quotation_sections   │                             │quotation_payment_   │
└─────────┬───────────┘                             │schedules            │
          │ 1                                       └─────────────────────┘
          │
          │ 1..*
┌─────────▼───────────┐
│quotation_items      │
└─────────────────────┘
```

### 4.1 Proposed Tables & Cardinalities

1. **`public.quotations`** (Root Identity)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `lead_id` (uuid, references public.leads(id) on delete restrict, not null)
   - `quotation_number` (text, unique, not null) — e.g., `OD-Q-2026-0001`
   - `created_by` (uuid, references auth.users(id), not null)
   - `created_at` (timestamptz, default now(), not null)
   - `updated_at` (timestamptz, default now(), not null)

2. **`public.quotation_versions`** (Version Ledger & Monetary Totals)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `quotation_id` (uuid, references public.quotations(id) on delete restrict, not null)
   - `version_number` (integer, not null) — Monotonic version counter (1, 2, 3...)
   - `status` (text, not null) — Allowed in 7A: `'draft'`. (7B statuses reserved: `'finalized'`, `'sent'`, `'accepted'`, `'rejected'`, `'expired'`).
   - `is_current_draft` (boolean, not null default true) — Helper flag for one-draft invariant.
   - `title` (text, not null default 'Initial Quotation')
   - `client_name_snapshot` (text)
   - `client_email_snapshot` (text)
   - `client_phone_snapshot` (text)
   - `property_address_snapshot` (text)
   - `scope_summary` (text)
   - `subtotal_paise` (bigint, not null default 0) — Sum of line items
   - `discount_type` (text, not null default 'flat') — `'flat'` or `'percentage'`
   - `discount_value_paise` (bigint, not null default 0) — Flat discount amount in paise
   - `discount_percentage` (numeric(5,2), not null default 0.00) — Percentage discount
   - `discount_total_paise` (bigint, not null default 0) — Calculated discount total
   - `taxable_base_paise` (bigint, not null default 0) — Subtotal minus discount (Achievement Basis)
   - `tax_rate_percentage` (numeric(5,2), not null default 18.00) — Tax percentage rate
   - `tax_total_paise` (bigint, not null default 0) — Calculated tax total
   - `grand_total_paise` (bigint, not null default 0) — Taxable base plus tax
   - `terms_and_conditions` (text)
   - `inclusions` (text[])
   - `exclusions` (text[])
   - `created_by` (uuid, references auth.users(id), not null)
   - `created_at` (timestamptz, default now(), not null)
   - `updated_at` (timestamptz, default now(), not null)

3. **`public.quotation_sections`** (Layout Groups)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `quotation_version_id` (uuid, references public.quotation_versions(id) on delete cascade, not null)
   - `section_name` (text, not null) — e.g. "Living Room", "Kitchen"
   - `display_order` (integer, not null)
   - `subtotal_paise` (bigint, not null default 0)
   - `created_at` (timestamptz, default now(), not null)

4. **`public.quotation_items`** (Line Items)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `section_id` (uuid, references public.quotation_sections(id) on delete cascade, not null)
   - `item_name` (text, not null)
   - `description` (text)
   - `specifications` (text) — Material / finish specifications
   - `quantity` (numeric(10,3), not null default 1.000)
   - `unit_of_measure` (text, not null default 'sqft') — e.g. 'sqft', 'rft', 'nos', 'ls'
   - `unit_rate_paise` (bigint, not null default 0)
   - `line_total_paise` (bigint, not null default 0) — `round(quantity * unit_rate_paise)`
   - `display_order` (integer, not null)
   - `created_at` (timestamptz, default now(), not null)

5. **`public.quotation_payment_schedules`** (Payment Milestones)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `quotation_version_id` (uuid, references public.quotation_versions(id) on delete cascade, not null)
   - `milestone_name` (text, not null) — e.g. "Advance / Booking", "Material Delivery"
   - `milestone_order` (integer, not null)
   - `percentage` (numeric(5,2), not null)
   - `amount_paise` (bigint, not null) — `round(grand_total_paise * (percentage / 100))`
   - `created_at` (timestamptz, default now(), not null)

---

## 5. One Mutable Draft Invariant & Version Monotonicity

### 5.1 Invariant Contract
- For any `quotation_id`, there exists **at most ONE** row in `public.quotation_versions` where `status = 'draft'` AND `is_current_draft = true`.
- Partial Unique Index Enforcement:
  ```sql
  create unique index idx_one_current_draft_per_quotation
    on public.quotation_versions (quotation_id)
    where (status = 'draft' and is_current_draft = true);
  ```
- **Monotonic Version Numbering:**
  When creating a new revision, `version_number := coalesce(max(version_number), 0) + 1` for the given `quotation_id`.
- **Immutable History Rule:**
  Finalized versions (Phase 7B) set `is_current_draft = false` and `status = 'finalized'`. Finalized versions and their child sections/items MUST NEVER be updated or deleted by draft mutation RPCs.

---

## 6. Monetary Arithmetic & Rounding Contract

1. **Integer Paise Storage:**
   All monetary amounts (`unit_rate_paise`, `line_total_paise`, `subtotal_paise`, `discount_value_paise`, `taxable_base_paise`, `tax_total_paise`, `grand_total_paise`, `amount_paise`) stored as 64-bit `bigint` (paise).
2. **Line Calculation Formula:**
   `line_total_paise = round(quantity * unit_rate_paise)`
3. **Subtotal Formula:**
   `subtotal_paise = sum(line_total_paise)`
4. **Discount Calculation:**
   - If `discount_type = 'flat'`: `discount_total_paise = min(discount_value_paise, subtotal_paise)`
   - If `discount_type = 'percentage'`: `discount_total_paise = round(subtotal_paise * (discount_percentage / 100.0))`
5. **Taxable Base (Achievement Basis):**
   `taxable_base_paise = subtotal_paise - discount_total_paise`
6. **Tax Calculation:**
   `tax_total_paise = round(taxable_base_paise * (tax_rate_percentage / 100.0))`
7. **Grand Total:**
   `grand_total_paise = taxable_base_paise + tax_total_paise`
8. **Payment Schedule Validation Invariant:**
   `sum(percentage) == 100.00` and `sum(amount_paise) == grand_total_paise` (with last milestone absorbing any integer paise rounding residual).

---

## 7. RLS & Authorization Contract

### 7.1 System Permissions Required (Catalogue Expansion in M25)
- `quotations.read` — View quotations for assigned leads (Sales Executive) or all leads (Manager/Super Admin).
- `quotations.create` — Create initial quotation draft for an assigned lead.
- `quotations.edit` — Update mutable draft, sections, items, discounts, or payment schedule.
- `quotations.delete` — Archive/cancel an un-finalized draft quotation.

*(Note: `quotations.approve` IS STRICTLY FORBIDDEN per DEC-0056 & ADR-0022).*

### 7.2 RLS Scoping Rules
- **Sales Executive:** Read and write access restricted strictly to quotations where `lead_id` is currently assigned to the active staff actor (`lead.assigned_sales_executive_id = auth.uid()`).
- **Sales Manager & Super Admin:** Broad read and write access across all quotations.
- **Project Manager & Designer:** ZERO read/write access to quotation drafts in Phase 7A.

---

## 8. Conceptual M25 Migration Plan (Reserved — NOT Created)

When authorized for implementation in Phase 7A, **M25** will contain:
1. `CREATE TABLE public.quotations` + RLS + Indexes
2. `CREATE TABLE public.quotation_versions` + Partial Unique Index + RLS
3. `CREATE TABLE public.quotation_sections` + RLS + Indexes
4. `CREATE TABLE public.quotation_items` + RLS + Indexes
5. `CREATE TABLE public.quotation_payment_schedules` + RLS + Indexes
6. System permissions registration in `public.permissions`:
   `quotations.read`, `quotations.create`, `quotations.edit`, `quotations.delete`
7. Transactional RPC helpers:
   - `public.create_quotation_draft(...)`
   - `public.save_quotation_draft_items(...)`
   - `public.recalculate_quotation_version_totals(...)`

**M25 File Status:** **ABSENT** in this turn. No database writes executed.

---

## 9. Test Strategy & Quality Gate Matrix (For Future Implementation)

### 9.1 Database & pgTAP Tests
- `0018_quotations_foundation_test.sql`:
  - RLS assigned-lead isolation for Sales Executive.
  - Denied access for unassigned Sales Executive.
  - Denied access for Project Manager and Designer.
  - Verification that `quotations.approve` permission DOES NOT exist.
  - One-current-draft unique constraint validation.
  - Canonical money calculation accuracy (paise rounding, tax, discount).
  - Monotonic version increment on new draft creation.

### 9.2 Application & Component Tests
- `src/features/quotations/__tests__/phase-7a-quotation-draft.test.ts`:
  - Draft editor render & recalculation.
  - Assigned-lead executive access validation.
  - Absence of approval UI buttons or approval status indicators.
  - Client snapshot population.

---

## 10. Explicit Non-Actions & Entry Gate Summary

### 10.1 Non-Actions Enforced
- 🚫 **NO** M25 migration created or applied.
- 🚫 **NO** managed database DDL or SQL executed.
- 🚫 **NO** quotation runtime application code implemented.
- 🚫 **NO** approval workflows or `quotations.approve` permissions added.
- 🚫 **NO** PDF generation or storage bucket setup.
- 🚫 **NO** WhatsApp or Meta Cloud API integration calls.
- 🚫 **NO** client acceptance, rejection, or token logic.
- 🚫 **NO** Closed-Won lead lifecycle transitions or project creation.
- 🚫 **NO** production deployment or intake activation.

### 10.2 Final Phase 7A Architecture Status
```
PHASE_7A_ARCHITECTURE_FREEZE: PASS
M25: NOT CREATED
MANAGED_WRITE: NONE
PHASE_7A_IMPLEMENTATION: NOT STARTED
PHASE_7B: NOT STARTED
```
