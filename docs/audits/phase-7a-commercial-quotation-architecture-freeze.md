# ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation Entry Audit & Architecture Contract Freeze (Final Owner Decision Lock)

**Document Status:** Locked Architecture Freeze & Entry Audit (Final Owner Decision Lock)  
**Date:** August 11, 2026  
**Repository Baseline:** Protected `main` commit `eb524d166e09b3160526ff5d0c642a1a65012f88` (PR #51 merged)  
**Managed Baseline:** Supabase project `lpurlfmpvriyvpkujvyl` (`ap-south-1`) aligned M1–M24  
**Current Phase:** Phase 7A — Commercial Quotation Data & Draft Foundation (**ENTRY AUDIT & ARCHITECTURE FREEZE ONLY**)  

---

## 1. Repository & Managed Baseline Verification

| Metric / Item | Status / Value | Verification Evidence |
| :--- | :--- | :--- |
| Worktree Path | `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase6c` | `pwd` confirmed |
| Architecture Branch | `phase-7a-quotation-architecture-freeze` | Active working branch |
| `origin/main` SHA | `eb524d166e09b3160526ff5d0c642a1a65012f88` | `git rev-parse origin/main` |
| PR #51 Merge Commit | `eb524d166e09b3160526ff5d0c642a1a65012f88` | Merged into `origin/main` |
| Repository Migrations | `24` files (`M1–M24`) | `supabase/migrations/*.sql` |
| Latest Migration | `20260811140000_staff_attendance_idempotency_repair.sql` | M24 verified |
| M25 Status | **ABSENT** (Conceptually reserved; NOT created) | File system check confirmed |
| Managed Alignment | `24` migrations (`M1–M24`) | `npx supabase migration list --linked` |
| Working Tree Status | CLEAN (Docs updates only for Phase 7A freeze) | `git status` confirmed |

---

## 2. Locked Owner Architecture Decisions (OD7A-1 through OD7A-5)

All Phase 7A owner architecture decisions have been explicitly authorized and locked (`LOCK PHASE 7A OWNER DECISIONS AS RECOMMENDED`):

### OD7A-1 — Lead ↔ Quotation Root Cardinality
- **LOCKED:** Exactly **ONE** quotation root per lead in V1 (`public.quotations.lead_id` is `UNIQUE`).
- All quotation revisions belong to the same root as separate monotonic versions (`quotation_versions`).
- V1 does not support multiple competing quotation roots or proposal families for one lead.
- Revisions never create a second quotation root for a lead.

### OD7A-2 — Payment Schedule Model & Nullability Consistency
- **LOCKED:** Explicit **SCHEDULE-LEVEL** mode (`payment_schedule_mode in ('percentage', 'amount')`).
- No mixing of percentage-based and amount-based milestones within one version.
- **Percentage Mode:** Milestone percentages are required authoritative inputs (`sum(percentage) = 100.00`). If `grand_total_paise` is NULL/incomplete (unconfigured tax profile), derived `amount_paise` remains NULL and the schedule is incomplete/unreconciled. Once `grand_total_paise` exists, `amount_paise` values are server-derived (`amount_paise = round(grand_total_paise * (percentage / 100.00))`) and the final ordered milestone absorbs any integer paise rounding residual so `sum(amount_paise) == grand_total_paise` exactly.
- **Amount Mode:** Milestone amounts in paise are required authoritative inputs (`amount_paise` non-null, `sum(amount_paise) == grand_total_paise`). Percentages remain NULL. Amount mode cannot claim reconciliation while `grand_total_paise` is NULL.

### OD7A-3 — Quotation Number Format
- **LOCKED:** Format **`OD-Q-{YYYY}-{SEQ6}`** (e.g. `OD-Q-2026-000123`).
- Generated transactionally/race-safely on server/DB (PostgreSQL sequence or locked allocator).
- `YYYY` derived using commercial calendar year in `Asia/Kolkata` timezone.
- Immutable, unique, sequence gaps acceptable. Browser generation forbidden.

### OD7A-4 — Tax Configuration Architecture
- **LOCKED:** Controlled Super-Admin-governed tax-profile catalogue (`public.quotation_tax_profiles`).
- **NO** seeded or default GST percentage. **NO** assumed 18%, 5%, or any production default rate.
- Draft versions snapshot `tax_profile_id` and `tax_rate_percentage`.
- **NULL Tax Contract:** A draft with no configured tax profile (`tax_profile_id = NULL`) has `tax_total_paise = NULL` and `grand_total_paise = NULL` and is commercially incomplete.
- **Explicit 0.00% Tax:** Valid only if an authoritative 0% tax profile was explicitly configured and selected.

### OD7A-5 — Hard Commercial Discount Bounds Architecture
- **LOCKED:** **NO** manager override, **NO** quotation approval workflow, **NO** per-quotation approval request path.
- Super Admin configures the authoritative hard maximum discount bound separately.
- Phase 7B finalization evaluates the configured bound and rejects finalization if exceeded — without manager override or approval routing.

---

## 3. Governing Business Rules & Contradiction Audit

### 3.1 Locked Commercial Decisions (DEC-0056 & ADR-0022)
1. **NO Internal Approval Workflow in V1:**
   - **NO** `Submitted for Approval` status. **NO** `Approved` state.
   - **NO** `quotations.approve` permission. **NO** approval tables or maker-checker rules.
   - Assigned Sales Executive can create, edit, finalize (7B), and send (7B) quotations for assigned leads.
2. **Canonical CRM Assignment Column (`leads.assigned_to`):**
   - Lead ownership and assigned-executive scope use existing CRM column **`public.leads.assigned_to`**.
   - Assigned Sales Executive scope evaluates `leads.assigned_to = auth.uid()`.
   - Reassignment of `leads.assigned_to` immediately shifts quotation read/write access to the new owner.
3. **Canonical Achievement Basis:**
   - **`taxable_base_paise`** (post-discount, pre-tax) is the sole achievement basis for sales performance (DEC-0056).
   - **GST/tax MUST NOT inflate sales achievement.**
4. **Non-Enumerating Privacy Error Contract:**
   - Outward fail-closed error code: **`QUOTATION_NOT_FOUND_OR_FORBIDDEN`**.
   - Prevents leaking whether a quotation ID or lead ID exists to unauthorized callers.

---

## 4. Scope Boundary: Phase 7A vs Phase 7B

### 4.1 Phase 7A Scope (Inclusions)
- **Quotation Root Identity:** `quotations` table linked 1:1 with `public.leads(id)` (`lead_id` UNIQUE).
- **Version Management:** `quotation_versions` table with monotonic `version_number`.
- **One Mutable Draft Invariant:** Only one active draft version allowed per quotation at any time (`idx_one_current_draft_per_quotation`).
- **Optimistic Concurrency Control:** `lock_version bigint` on `quotation_versions` (stale edits raise `QUOTATION_VERSION_CONFLICT`).
- **Durable Idempotency Ledger:** `private.quotation_idempotency_requests` table.
- **Quotation Event Audit Ledger:** `public.quotation_events` table (append-only quotation event trail).
- **Section / Room Structure:** `quotation_sections` table for layout grouping.
- **Line Item Details:** `quotation_items` table (description, specifications, quantity, explicit UOM, unit rate in paise, line total in paise).
- **Draft Payment Schedule:** `quotation_payment_schedules` milestone structure supporting percentage or amount mode (OD7A-2).
- **Header & Terms Snapshots:** Inclusions (`text[]`), exclusions (`text[]`), terms & conditions (`text`), client/property snapshot fields.
- **Canonical Money Arithmetic:** Server/DB integer paise calculations (`subtotal_paise`, `discount_total_paise`, `taxable_base_paise`, `tax_total_paise`, `grand_total_paise`).
- **Quotation-Level Discount Only:** Single discount per draft version (`discount_type in ('none', 'flat', 'percentage')`). Mutual exclusion enforced via DB CHECK constraints.
- **RLS & Authorization:** Five-role model integration using `leads.assigned_to`; Sales Executive assigned-lead scope; Manager/Admin broad scope; PM/Designer ZERO mutation scope.

### 4.2 Phase 7B / 8A / 10 Exclusions (Strictly Prohibited in 7A)
- ❌ **Quotation Finalization Runtime:** (`finalize_quotation_version` RPC belongs to 7B).
- ❌ **PDF Generation & Storage:** (No PDF engine, templates, or bucket uploads in 7A).
- ❌ **WhatsApp / Delivery Runtime:** (No `send_quotation` RPC or WhatsApp dispatch in 7A).
- ❌ **Public / Client Access:** (No public quotation viewing link, tokens, or portal in 7A).
- ❌ **Client Acceptance / Rejection:** (No client accept/reject token, e-signature, or response tracking in 7A).
- ❌ **Closed-Won Project Conversion:** (No project creation or Closed-Won status mutation in 7A).
- ❌ **Sales Achievement Activation:** (Commercial target achievement remains inactive in 7A).
- ❌ **Migration M25 Creation / Apply:** (M25 reserved conceptually; zero DB schema writes in 7A turn).

---

## 5. Quotation Relational Data Model (Conceptual Design for M25)

```
                       ┌─────────────────────────┐
                       │      public.leads       │ (assigned_to = current owner)
                       └────────────┬────────────┘
                                    │ 1
                                    │ 1:1 (UNIQUE lead_id)
                       ┌────────────▼────────────┐
                       │    public.quotations    │ (Root Identity: status in 'active','archived')
                       └────────────┬────────────┘
                                    │ 1
                                    │ 1..*
                       ┌────────────▼────────────┐
                       │ public.quotation_versions│ (Monotonic Versions & lock_version)
                       └──────┬───────────┬──────┘
                              │           │
                     1..*     │           │     1..* (Schedule-Level Mode: OD7A-2)
          ┌───────────────────┘           └───────────────────┐
          │                                                   │
┌─────────▼───────────┐                             ┌─────────▼───────────┐
│quotation_sections   │                             │quotation_payment_   │
└─────────┬───────────┘                             │schedules            │
          │ 1                                       └─────────────────────┘
          │ 1..*
┌─────────▼───────────┐
│quotation_items      │
└─────────────────────┘
```

### 5.1 Proposed Public & Private Tables

1. **`public.quotations`** (Root Identity)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `lead_id` (uuid, unique, references public.leads(id) on delete restrict, not null)
   - `quotation_number` (text, unique, not null) — Format `OD-Q-{YYYY}-{SEQ6}` (OD7A-3)
   - `status` (text, not null default 'active' check (status in ('active', 'archived')))
   - `created_by` (uuid, references public.profiles(id) on delete restrict, not null)
   - `updated_by` (uuid, references public.profiles(id))
   - `created_at` (timestamptz, default now(), not null)
   - `updated_at` (timestamptz, default now(), not null)

2. **`public.quotation_versions`** (Version Ledger, Monetary Totals & Lock Version)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `quotation_id` (uuid, references public.quotations(id) on delete restrict, not null)
   - `version_number` (integer, not null) — Monotonic version counter (1, 2, 3...)
   - `lock_version` (bigint, not null default 1) — Optimistic concurrency counter
   - `status` (text, not null default 'draft' check (status in ('draft', 'archived'))) — 7B reserved: `'finalized'`, `'sent'`, `'accepted'`, `'rejected'`, `'expired'`.
   - `is_current_draft` (boolean, not null default true)
   - `title` (text, not null) — User proposal title (no hardcoded string default)
   - `client_name_snapshot` (text)
   - `client_email_snapshot` (text)
   - `client_phone_snapshot` (text)
   - `property_address_snapshot` (text)
   - `scope_summary` (text)
   - `payment_schedule_mode` (text check (payment_schedule_mode in ('percentage', 'amount')))
   - `subtotal_paise` (bigint, not null default 0 check (subtotal_paise >= 0))
   - `discount_type` (text, not null default 'none' check (discount_type in ('none', 'flat', 'percentage')))
   - `discount_value_paise` (bigint, not null default 0 check (discount_value_paise >= 0))
   - `discount_percentage` (numeric(5,2), not null default 0.00 check (discount_percentage >= 0.00 and discount_percentage <= 100.00))
   - `discount_total_paise` (bigint, not null default 0 check (discount_total_paise >= 0))
   - `taxable_base_paise` (bigint, not null default 0 check (taxable_base_paise >= 0)) — Achievement Basis
   - `tax_profile_id` (uuid, references public.quotation_tax_profiles(id) on delete restrict) — Snapshot Tax Profile (OD7A-4)
   - `tax_rate_percentage` (numeric(5,2)) — Snapshot Rate (NULL if unconfigured; NO 18.00 DEFAULT)
   - `tax_total_paise` (bigint check (tax_total_paise >= 0)) — NULL if unconfigured
   - `grand_total_paise` (bigint check (grand_total_paise >= 0)) — NULL if unconfigured
   - `terms_and_conditions` (text)
   - `inclusions` (text[] not null default '{}'::text[])
   - `exclusions` (text[] not null default '{}'::text[])
   - `created_by` (uuid, references public.profiles(id) on delete restrict, not null)
   - `updated_by` (uuid, references public.profiles(id))
   - `created_at` (timestamptz, default now(), not null)
   - `updated_at` (timestamptz, default now(), not null)

3. **`public.quotation_sections`** (Layout Groups)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `quotation_version_id` (uuid, references public.quotation_versions(id) on delete restrict, not null)
   - `section_name` (text, not null)
   - `display_order` (integer, not null)
   - `subtotal_paise` (bigint, not null default 0 check (subtotal_paise >= 0))
   - `created_at` (timestamptz, default now(), not null)

4. **`public.quotation_items`** (Line Items)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `section_id` (uuid, references public.quotation_sections(id) on delete restrict, not null)
   - `item_name` (text, not null)
   - `description` (text)
   - `specifications` (text)
   - `quantity` (numeric(10,3), not null check (quantity > 0))
   - `unit_of_measure` (text, not null) — Explicit UOM per item (no blanket 'sqft' default)
   - `unit_rate_paise` (bigint, not null check (unit_rate_paise >= 0))
   - `line_total_paise` (bigint, not null check (line_total_paise >= 0))
   - `display_order` (integer, not null)
   - `created_at` (timestamptz, default now(), not null)

5. **`public.quotation_payment_schedules`** (Payment Milestones — OD7A-2)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `quotation_version_id` (uuid, references public.quotation_versions(id) on delete restrict, not null)
   - `milestone_name` (text, not null)
   - `milestone_order` (integer, not null)
   - `percentage` (numeric(5,2) check (percentage >= 0.00 and percentage <= 100.00)) — Required in percentage mode; NULL in amount mode
   - `amount_paise` (bigint check (amount_paise >= 0)) — Required in amount mode; derived (nullable while grand_total_paise is NULL) in percentage mode
   - `created_at` (timestamptz, default now(), not null)

6. **`public.quotation_tax_profiles`** (Tax Profile Catalogue — OD7A-4)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `code` (text, unique, not null) — Rate-neutral identifiers (e.g., `'standard_tax'`, `'zero_rated'`)
   - `display_name` (text, not null)
   - `rate_percentage` (numeric(5,2), not null check (rate_percentage >= 0.00 and rate_percentage <= 100.00))
   - `is_active` (boolean, not null default true)
   - `created_by` (uuid, references public.profiles(id) on delete restrict, not null)
   - `created_at` (timestamptz, default now(), not null)

7. **`public.quotation_events`** (Quotation Event Audit Ledger)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `quotation_id` (uuid, references public.quotations(id) on delete restrict, not null)
   - `quotation_version_id` (uuid, references public.quotation_versions(id) on delete restrict)
   - `lead_id` (uuid, references public.leads(id) on delete restrict, not null)
   - `event_type` (text, not null)
   - `actor_id` (uuid, references public.profiles(id) on delete restrict, not null)
   - `details` (jsonb, not null default '{}'::jsonb)
   - `occurred_at` (timestamptz, default now(), not null)

8. **`private.quotation_idempotency_requests`** (Private Idempotency Ledger)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `actor_id` (uuid, references public.profiles(id) on delete restrict, not null)
   - `operation_code` (text, not null)
   - `idempotency_key` (text, not null)
   - `request_hash` (text, not null) — SHA-256 hash of canonical request input
   - `quotation_id` (uuid)
   - `quotation_version_id` (uuid)
   - `response_snapshot` (jsonb)
   - `created_at` (timestamptz, default now(), not null)
   - UNIQUE constraint on `(actor_id, operation_code, idempotency_key)`

---

## 6. Versioning, Race Safety & Idempotency Contracts

### 6.1 One Mutable Draft Invariant
- Partial unique index:
  ```sql
  create unique index idx_one_current_draft_per_quotation
    on public.quotation_versions (quotation_id)
    where (status = 'draft' and is_current_draft = true);
  ```

### 6.2 Monotonic & Race-Safe Version Creation
- Version numbers unique per quotation: `UNIQUE (quotation_id, version_number)`.
- Revision creation acquires row lock on `public.quotations`:
  ```sql
  perform 1 from public.quotations where id = p_quotation_id for update;
  select coalesce(max(version_number), 0) + 1 into v_next_version
    from public.quotation_versions where quotation_id = p_quotation_id;
  ```

### 6.3 Optimistic Concurrency Control (`lock_version`)
- Stale edits check `lock_version` and raise `QUOTATION_VERSION_CONFLICT`.

### 6.4 Durable Idempotency Ledger Contract
- Reuses Phase 6B durable idempotency pattern (`private.quotation_idempotency_requests`).
- Advisory lock on `actor_id + operation_code + idempotency_key`.
- Same key + same request hash: Replay prior result (`idempotentReplay = true`).
- Same key + different request hash: Raise `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`.

---

## 7. Monetary Arithmetic, Discount & Tax Contract

### 7.1 Integer Paise Calculation Rules
1. `line_total_paise = round(quantity * unit_rate_paise)`
2. `subtotal_paise = sum(line_total_paise)`
3. **Discount Total Calculation:**
   - `discount_type = 'none'`: `discount_total_paise = 0`
   - `discount_type = 'flat'`: `discount_total_paise = discount_value_paise`
   - `discount_type = 'percentage'`: `discount_total_paise = round((subtotal_paise::numeric * (discount_percentage / 100.00))::numeric)::bigint`
4. **Over-Discount Validation:**
   If `discount_total_paise > subtotal_paise`, raise `QUOTATION_VALIDATION_FAILED`. No silent clipping via `min()`.
5. **Taxable Base (Sales Achievement Basis per DEC-0056):**
   `taxable_base_paise = subtotal_paise - discount_total_paise`
6. **Tax Total Calculation (OD7A-4):**
   - If `tax_rate_percentage` is provided: `tax_total_paise = round((taxable_base_paise::numeric * (tax_rate_percentage / 100.00))::numeric)::bigint`
   - If `tax_rate_percentage` is NULL: `tax_total_paise = NULL`, `grand_total_paise = NULL` (commercially incomplete).
7. **Grand Total:**
   `grand_total_paise = taxable_base_paise + tax_total_paise` (if tax is configured).

---

## 8. Deletion, Immutability & Cascade Safety

1. **NO Direct Staff DELETE Privilege:**
   - `DELETE` queries on quotation tables DENIED to staff.
   - `quotations.delete` permission is REMOVED.
2. **Draft Archival via State Mutation:**
   - Archive draft via `archive_quotation_draft(...)` which updates `status := 'archived'` and appends `quotation.draft_archived` to `public.quotation_events`.
3. **FK Delete Semantics (`ON DELETE RESTRICT`):**
   - FKs from child tables use `ON DELETE RESTRICT` to prevent accidental cascading deletion.

---

## 9. RLS & CRM Authorization Integration

### 9.1 System Permissions Required (Catalogue Expansion in M25)
- `quotations.read` — View quotations for assigned leads (Sales Executive) or all leads (Manager/Super Admin).
- `quotations.create` — Create initial quotation draft for an assigned lead.
- `quotations.edit` — Update mutable draft, sections, items, discounts, or payment schedule.

*(Note: `quotations.delete` and `quotations.approve` ARE STRICTLY EXCLUDED).*

### 9.2 RLS Policy Composition
- **Sales Executive:** Read/write access strictly scoped via linked lead ownership (`leads.assigned_to = auth.uid()`).
- **Sales Manager & Super Admin:** Broad read/write access via CRM broad-scope permissions.
- **Project Manager & Designer:** ZERO access to quotation drafts in Phase 7A.

---

## 10. Conceptual M25 Migration Plan (Reserved — NOT Created)

When authorized for implementation in Phase 7A:
1. `CREATE TABLE public.quotations` + RLS + Indexes
2. `CREATE TABLE public.quotation_versions` + Partial Unique Index + RLS
3. `CREATE TABLE public.quotation_sections` + RLS + Indexes
4. `CREATE TABLE public.quotation_items` + RLS + Indexes
5. `CREATE TABLE public.quotation_payment_schedules` + RLS + Indexes
6. `CREATE TABLE public.quotation_tax_profiles` + RLS + Indexes
7. `CREATE TABLE public.quotation_events` + RLS + Indexes
8. `CREATE TABLE private.quotation_idempotency_requests` + Indexes
9. System permissions registration: `quotations.read`, `quotations.create`, `quotations.edit`.
10. Transactional RPC helpers:
    - `public.create_quotation_draft(...)`
    - `public.save_quotation_draft_items(...)`
    - `public.archive_quotation_draft(...)`

**M25 File Status:** **ABSENT** in this turn. No database writes executed.

---

## 11. Application Surface & Service Contract (Planning Only — NOT Built)

### 11.1 Routes & Pages
- `/admin/quotations` — Internal quotation overview table.
- `/admin/crm/leads/[id]?tab=quotations` — Lead detail panel quotation tab.
- `/admin/quotations/[id]/draft` — Interactive quotation draft editor.

### 11.2 UI Editor Component Hierarchy
- `QuotationDraftEditor` (Container with optimistic state & `lock_version` check)
  - `QuotationHeaderCard` (Title, Client/Property Snapshot, Tax Profile Selector)
  - `QuotationSectionAccordion` (Room/Area grouping)
    - `QuotationLineItemTable` (Item descriptions, quantity, UOM, unit rate, line total)
  - `QuotationDiscountCard` (Type, Value/Percentage, Calculated Discount)
  - `QuotationPaymentScheduleEditor` (Percentage or Amount Mode Milestones)
  - `QuotationTermsEditor` (Inclusions, Exclusions, Terms & Conditions)
  - `QuotationTotalsSummary` (Subtotal, Discount, Taxable Base, Tax, Grand Total)
  - `QuotationConflictBanner` (Rendered when `QUOTATION_VERSION_CONFLICT` occurs)

---

## 12. Test Matrix (For Future Implementation)

### 12.1 Database & pgTAP Tests (`0018_quotations_foundation_test.sql`)
- **AUTHORIZATION**:
  - Assigned Sales Executive can view/edit quotation for lead where `assigned_to = auth.uid()`.
  - Unassigned Sales Executive receives `QUOTATION_NOT_FOUND_OR_FORBIDDEN`.
  - Reassignment of `leads.assigned_to` immediately transfers quotation access.
  - Sales Manager & Super Admin have broad access.
  - Project Manager and Designer are DENIED access (`42501`).
  - Verification that `quotations.approve` permission DOES NOT exist in database.
- **DOMAIN & VERSIONING**:
  - `idx_one_current_draft_per_quotation` prevents two current drafts for same quotation.
  - Revision creation increments `version_number` monotonically under root row lock.
- **MONEY & ARITHMETIC**:
  - `line_total_paise` = `round(quantity * unit_rate_paise)`.
  - Over-discount (`discount_total_paise > subtotal_paise`) raises `QUOTATION_VALIDATION_FAILED`.
  - Synthetic test tax rate calculates `tax_total_paise` exactly.
  - NULL tax profile sets `tax_total_paise = NULL` and `grand_total_paise = NULL`.
- **PAYMENT SCHEDULE MODE**:
  - Percentage mode + NULL grand total => percentages stored, derived `amount_paise` is NULL, schedule is incomplete/unreconciled.
  - Percentage mode + grand total set => `amount_paise` derived and final milestone absorbs residual.
  - Amount mode rejects NULL milestone amount.
  - Amount mode cannot claim reconciliation while `grand_total_paise` is NULL.
- **CONCURRENCY & IDEMPOTENCY**:
  - Stale `lock_version` raises `QUOTATION_VERSION_CONFLICT`.
  - `p_idempotency_key` replay returns previous result with `idempotentReplay = true`.
  - Reusing idempotency key with different payload raises `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`.
- **DELETION & IMMUTABILITY**:
  - Direct SQL `DELETE` by staff role raises permission denied.
  - FK delete restrict prevents cascading deletion.

---

## 13. Explicit Non-Actions & Entry Gate Summary

### 13.1 Non-Actions Enforced
- 🚫 **NO** M25 migration created or applied.
- 🚫 **NO** managed database DDL or SQL executed.
- 🚫 **NO** quotation runtime application code implemented.
- 🚫 **NO** approval workflows or `quotations.approve` permissions added.
- 🚫 **NO** PDF generation or storage bucket setup.
- 🚫 **NO** WhatsApp or Meta Cloud API integration calls.
- 🚫 **NO** client acceptance, rejection, or token logic.
- 🚫 **NO** Closed-Won lead lifecycle transitions or project creation.
- 🚫 **NO** production deployment or intake activation.

### 13.2 Final Phase 7A Architecture Status
```
PHASE_7A_ARCHITECTURE_FREEZE: PASS
OWNER_ARCHITECTURE_DECISIONS: LOCKED
UNRESOLVED_ARCHITECTURE_BLOCKERS: 0
M25_IMPLEMENTATION_ENTRY_GATE: READY_AFTER_PR52_MERGE
M25: NOT CREATED
MANAGED_WRITE: NONE
MANAGED_ALIGNMENT: M1–M24
PHASE_7A_IMPLEMENTATION: NOT STARTED
PHASE_7B: NOT STARTED
PR_52: NOT MERGED
```
