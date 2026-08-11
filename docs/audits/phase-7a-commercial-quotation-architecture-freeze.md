# ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation Entry Audit & Architecture Contract Freeze (Correction Pass)

**Document Status:** Locked Architecture Freeze & Entry Audit (Corrected Baseline)  
**Date:** August 11, 2026  
**Repository Baseline:** Protected `main` commit `eb524d166e09b3160526ff5d0c642a1a65012f88` (PR #51 merged)  
**Managed Baseline:** Supabase project `lpurlfmpvriyvpkujvyl` (`ap-south-1`) aligned M1–M24  
**Current Phase:** Phase 7A — Commercial Quotation Data & Draft Foundation (**ENTRY AUDIT & ARCHITECTURE FREEZE ONLY**)  

---

## 1. Repository & Managed Baseline Verification

| Metric / Item | Status / Value | Verification Evidence |
| :--- | :--- | :--- |
| Worktree Path | `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase6c` | `pwd` confirmed |
| Architecture Branch | `phase-7a-quotation-architecture-freeze` | Pushed to `origin` |
| `origin/main` SHA | `eb524d166e09b3160526ff5d0c642a1a65012f88` | `git rev-parse origin/main` |
| PR #51 Merge Commit | `eb524d166e09b3160526ff5d0c642a1a65012f88` | Merged into `origin/main` |
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
2. **Canonical CRM Assignment Column (`leads.assigned_to`):**
   - Lead ownership and assigned-executive scope use existing CRM column **`public.leads.assigned_to`**.
   - No duplicate quotation-side owner column (e.g. `assigned_sales_executive_id`) is introduced.
   - Assigned Sales Executive scope evaluates `leads.assigned_to = auth.uid()`.
   - Reassignment of `leads.assigned_to` immediately updates quotation access control.
3. **Canonical Achievement Basis:**
   - **`taxable_base_paise`** (post-discount, pre-tax) is the sole achievement basis for sales performance (DEC-0056).
   - **GST/tax MUST NOT inflate sales achievement.**
   - Customer grand total payable: `grand_total_paise = taxable_base_paise + tax_total_paise`.
4. **Closed-Won Invariant (ADR-0020):**
   - Requires an authoritative `Accepted` quotation (Phase 7B / 8A).
   - Phase 7A MUST NOT create projects, update lead lifecycle to Closed-Won, or activate sales targets.
5. **Outbound Channel Boundary (ADR-0021 & Phase 6B):**
   - Future Phase 7B delivery must pass through Phase 6B `WHATSAPP_SERVICE` boundary.
   - No direct Meta Cloud API send path inside quotation domain.

---

## 3. Scope Boundary: Phase 7A vs Phase 7B

### 3.1 Phase 7A Scope (Inclusions)
- **Quotation Root Identity:** `quotations` table linked to `public.leads(id)`.
- **Version Management:** `quotation_versions` table with monotonic `version_number`.
- **One Mutable Draft Invariant:** Only one active draft version allowed per quotation at any time (`idx_one_current_draft_per_quotation`).
- **Optimistic Concurrency Control:** `lock_version bigint` on `quotation_versions` to prevent silent multi-tab overwrites.
- **Section / Room Structure:** `quotation_sections` table for layout grouping (e.g. Living Room, Master Bedroom, Kitchen).
- **Line Item Details:** `quotation_items` table (description, specifications, quantity, explicit unit of measure, unit rate in paise, line total in paise).
- **Draft Payment Schedule:** `quotation_payment_schedules` milestone structure.
- **Header & Terms Snapshots:** Inclusions (`text[]`), exclusions (`text[]`), terms & conditions (`text`), client/property snapshot fields.
- **Canonical Money Arithmetic:** Server/DB integer paise calculations (`subtotal_paise`, `discount_total_paise`, `taxable_base_paise`, `tax_total_paise`, `grand_total_paise`).
- **Quotation-Level Discount Only:** Single discount per draft version (`discount_type in ('none', 'flat', 'percentage')`). No line-item discounts.
- **RLS & Authorization:** Five-role model integration using `leads.assigned_to`; Sales Executive assigned-lead scope; Manager/Admin broad scope; PM/Designer ZERO mutation scope.

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
                       │      public.leads       │ (assigned_to = current owner)
                       └────────────┬────────────┘
                                    │ 1
                                    │
                                    │ 1 (or 1..* per Owner Decision K)
                       ┌────────────▼────────────┐
                       │    public.quotations    │ (Root Identity)
                       └────────────┬────────────┘
                                    │ 1
                                    │
                                    │ 1..*
                       ┌────────────▼────────────┐
                       │ public.quotation_versions│ (Monotonic Versions & Lock Version)
                       └──────┬───────────┬──────┘
                              │           │
                     1..*     │           │     1..* (per Owner Decision J)
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
   - `quotation_number` (text, unique, not null) — Server-generated unique identifier
   - `status` (text, not null default 'draft') — Overall quotation root state (`'draft'`, `'archived'`, `'finalized'`)
   - `created_by` (uuid, references public.profiles(id), not null)
   - `updated_by` (uuid, references public.profiles(id))
   - `created_at` (timestamptz, default now(), not null)
   - `updated_at` (timestamptz, default now(), not null)

2. **`public.quotation_versions`** (Version Ledger, Monetary Totals & Lock Version)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `quotation_id` (uuid, references public.quotations(id) on delete restrict, not null)
   - `version_number` (integer, not null) — Monotonic version counter (1, 2, 3...)
   - `lock_version` (bigint, not null default 1) — Optimistic concurrency control counter
   - `status` (text, not null default 'draft') — `'draft'`, `'archived'`. (7B reserved: `'finalized'`, `'sent'`, `'accepted'`, `'rejected'`, `'expired'`).
   - `is_current_draft` (boolean, not null default true) — Helper flag for one-draft invariant.
   - `title` (text, not null) — User-provided proposal title (no hardcoded default string)
   - `client_name_snapshot` (text)
   - `client_email_snapshot` (text)
   - `client_phone_snapshot` (text)
   - `property_address_snapshot` (text)
   - `scope_summary` (text)
   - `subtotal_paise` (bigint, not null default 0 check (subtotal_paise >= 0))
   - `discount_type` (text, not null default 'none' check (discount_type in ('none', 'flat', 'percentage')))
   - `discount_value_paise` (bigint, not null default 0 check (discount_value_paise >= 0))
   - `discount_percentage` (numeric(5,2), not null default 0.00 check (discount_percentage >= 0.00 and discount_percentage <= 100.00))
   - `discount_total_paise` (bigint, not null default 0 check (discount_total_paise >= 0))
   - `taxable_base_paise` (bigint, not null default 0 check (taxable_base_paise >= 0)) — Achievement Basis
   - `tax_rate_percentage` (numeric(5,2)) — Explicit tax rate percentage (NO 18.00 DEFAULT)
   - `tax_total_paise` (bigint, not null default 0 check (tax_total_paise >= 0))
   - `grand_total_paise` (bigint, not null default 0 check (grand_total_paise >= 0))
   - `terms_and_conditions` (text)
   - `inclusions` (text[] not null default '{}'::text[])
   - `exclusions` (text[] not null default '{}'::text[])
   - `created_by` (uuid, references public.profiles(id), not null)
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

5. **`public.quotation_payment_schedules`** (Payment Milestones — Subject to Owner Decision J)
   - `id` (uuid, primary key, default gen_random_uuid())
   - `quotation_version_id` (uuid, references public.quotation_versions(id) on delete restrict, not null)
   - `milestone_name` (text, not null)
   - `milestone_order` (integer, not null)
   - `percentage` (numeric(5,2))
   - `amount_paise` (bigint not null check (amount_paise >= 0))
   - `created_at` (timestamptz, default now(), not null)

---

## 5. Versioning, Race Safety & Concurrency Contracts

### 5.1 One Mutable Draft Invariant
- For any `quotation_id`, at most **ONE** row in `public.quotation_versions` has `status = 'draft'` AND `is_current_draft = true`.
- Enforced via partial unique index:
  ```sql
  create unique index idx_one_current_draft_per_quotation
    on public.quotation_versions (quotation_id)
    where (status = 'draft' and is_current_draft = true);
  ```

### 5.2 Monotonic & Race-Safe Version Creation
- Version numbers are unique per quotation: `UNIQUE (quotation_id, version_number)`.
- Revision creation must be transactionally serialized using row locking:
  ```sql
  -- Perform inside transactional RPC:
  perform 1 from public.quotations where id = p_quotation_id for update;
  select coalesce(max(version_number), 0) + 1 into v_next_version
    from public.quotation_versions where quotation_id = p_quotation_id;
  ```
- Concurrent revision requests: One request succeeds deterministically; the concurrent request encounters row lock and either increments sequentially or returns a stable conflict code (`QUOTATION_DRAFT_CONFLICT`).

### 5.3 Optimistic Concurrency Control (`lock_version`)
- Every draft version contains `lock_version bigint not null default 1`.
- Draft mutation RPCs accept `p_expected_lock_version bigint`.
- If `lock_version != p_expected_lock_version`:
  RPC immediately raises exception `QUOTATION_VERSION_CONFLICT` (`errcode = 'P0002'`).
- Successful mutation increments `lock_version := lock_version + 1` and updates `updated_at := now()`.

### 5.4 Error Semantics & Standard Error Codes
- `QUOTATION_NOT_FOUND` (`errcode = 'P0001'` / `42501`) — Quotation does not exist or user lacks access.
- `QUOTATION_UNAUTHORIZED` (`errcode = '42501'`) — Actor does not own linked lead and lacks manager/admin permissions.
- `QUOTATION_NOT_MUTABLE` (`errcode = 'P0001'`) — Attempting to edit a finalized or archived version.
- `QUOTATION_VERSION_CONFLICT` (`errcode = 'P0002'`) — Stale `lock_version` submitted.
- `QUOTATION_VALIDATION_FAILED` (`errcode = 'P0001'`) — Invalid math, discount > subtotal, or missing required fields.
- `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH` (`errcode = 'P0001'`) — Same idempotency key reused with different payload.

---

## 6. Idempotency Contract

- Multi-row draft creation and revision RPCs accept `p_idempotency_key text`.
- Reuses ONEDECORE's established idempotency pattern (M14, M19+, M23/M24).
- RPC checks for prior execution with same `(actor_id, idempotency_key)`:
  - Same key + same payload: Return prior result with `idempotentReplay = true`.
  - Same key + different payload: Raise `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`.

---

## 7. Monetary Arithmetic, Discount & Tax Contract

### 7.1 Integer Paise Calculation Rules
All money calculations use PostgreSQL exact `numeric` arithmetic converted to `bigint` paise:
1. `line_total_paise = round(quantity * unit_rate_paise)`
2. `subtotal_paise = sum(line_total_paise)`
3. **Discount Total Calculation:**
   - `discount_type = 'none'`: `discount_total_paise = 0`
   - `discount_type = 'flat'`: `discount_total_paise = discount_value_paise`
   - `discount_type = 'percentage'`: `discount_total_paise = round((subtotal_paise::numeric * (discount_percentage / 100.00))::numeric)::bigint`
4. **Over-Discount Validation:**
   If `discount_total_paise > subtotal_paise`, raise `QUOTATION_VALIDATION_FAILED`. **No silent clipping (`min()`) of invalid discounts.**
5. **Taxable Base (Sales Achievement Basis per DEC-0056):**
   `taxable_base_paise = subtotal_paise - discount_total_paise`
6. **Tax Total Calculation:**
   - If `tax_rate_percentage` is provided: `tax_total_paise = round((taxable_base_paise::numeric * (tax_rate_percentage / 100.00))::numeric)::bigint`
   - If `tax_rate_percentage` is null/unsupplied: `tax_total_paise = 0`, and draft is marked `is_commercially_complete = false`.
7. **Grand Total:**
   `grand_total_paise = taxable_base_paise + tax_total_paise`

---

## 8. Deletion, Immutability & Cascade Safety

1. **NO Direct Staff DELETE Privilege:**
   - `DELETE` queries on `quotations`, `quotation_versions`, `quotation_sections`, `quotation_items`, and `quotation_payment_schedules` are DENIED to staff roles.
   - `quotations.delete` permission is REMOVED from the permission catalogue.
2. **Draft Archival via State Mutation:**
   - Draft cancellation/archival is performed via RPC `archive_quotation_draft(...)` which updates `status := 'archived'` and logs a lead activity event.
3. **FK Delete Semantics (`ON DELETE RESTRICT`):**
   - Foreign keys from child tables (`quotation_sections`, `quotation_items`, `quotation_payment_schedules`) to parent versions use `ON DELETE RESTRICT` to prevent accidental cascading destruction of commercial records.
4. **Finalized History Immutability (Phase 7B Hook):**
   - Finalized versions set `is_current_draft = false` and `status = 'finalized'`. Database triggers in 7B will reject any UPDATE or DELETE operations on finalized versions and their child rows.

---

## 9. RLS & CRM Authorization Integration

### 9.1 System Permissions Required (Catalogue Expansion in M25)
- `quotations.read` — View quotations for assigned leads (Sales Executive) or all leads (Manager/Super Admin).
- `quotations.create` — Create initial quotation draft for an assigned lead.
- `quotations.edit` — Update mutable draft, sections, items, discounts, or payment schedule.

*(Note: `quotations.delete` and `quotations.approve` ARE STRICTLY EXCLUDED).*

### 9.2 RLS Policy Composition
- **Sales Executive:** Read/write access strictly scoped via linked lead ownership:
  ```sql
  exists (
    select 1 from public.leads l
    where l.id = quotations.lead_id
      and l.assigned_to = auth.uid()
  )
  ```
- **Sales Manager & Super Admin:** Broad read/write access via `private.crm_is_sales_manager()` or `private.crm_is_super_admin()`.
- **Project Manager & Designer:** ZERO access to quotation drafts in Phase 7A.

---

## 10. Commercial Audit Trail Model

Quotation domain events log append-only records to `public.lead_activities` (linked by `lead_id`), reusing existing CRM audit infrastructure:
- `quotation_draft_created`
- `quotation_draft_updated`
- `quotation_draft_archived`
- `quotation_version_created`
- `quotation_discount_updated`
- `quotation_payment_schedule_updated`

Payload metadata (`metadata jsonb`) records `quotation_id`, `version_number`, `lock_version`, actor ID (`auth.uid()`), and financial snapshot totals in paise.

---

## 11. Unresolved Owner Decisions (M25 Implementation Blockers)

The following decisions require explicit owner choice before M25 schema creation and Phase 7A application implementation:

1. **Unresolved Decision 1: Lead ↔ Quotation Root Cardinality (Defect K)**
   - *Option A:* Exactly **ONE** quotation root per lead (lead owns 1 quotation root; revisions create new versions under that root).
   - *Option B:* **MULTIPLE** quotation roots per lead (allows alternative proposal concepts for the same lead).
2. **Unresolved Decision 2: Payment Schedule Strategy (Defect J)**
   - *Option A:* Percentage-only milestones (`sum(percentage) = 100.00%`).
   - *Option B:* Amount-only milestones (`sum(amount_paise) = grand_total_paise`).
   - *Option C:* Explicit strategy per schedule (`milestone_type in ('percentage', 'amount')`).
3. **Unresolved Decision 3: Quotation Numbering Format (Defect C)**
   - Server-generated unique human-readable sequence pattern (e.g. `OD-Q-{YYYY}-{SEQ}`).
4. **Unresolved Decision 4: Production Tax Rate Configuration (Defect B)**
   - Authoritative tax rates (e.g. 18.00% GST) configuration source.
5. **Unresolved Decision 5: Production Hard Commercial Bounds (Defect H & P)**
   - Maximum allowed discount threshold before manager override in Phase 7B.

---

## 12. Conceptual M25 Migration Plan (Reserved — NOT Created)

When authorized following owner resolution of decisions 1–5:
1. `CREATE TABLE public.quotations` + RLS + Indexes
2. `CREATE TABLE public.quotation_versions` + Partial Unique Index + RLS
3. `CREATE TABLE public.quotation_sections` + RLS + Indexes
4. `CREATE TABLE public.quotation_items` + RLS + Indexes
5. `CREATE TABLE public.quotation_payment_schedules` + RLS + Indexes
6. System permissions registration: `quotations.read`, `quotations.create`, `quotations.edit`.
7. Transactional RPC helpers:
   - `public.create_quotation_draft(...)`
   - `public.save_quotation_draft_items(...)`
   - `public.archive_quotation_draft(...)`

**M25 File Status:** **ABSENT** in this turn. No database writes executed.

---

## 13. Application Surface & Service Contract (Planning Only — NOT Built)

### 13.1 Routes & Pages
- `/admin/quotations` — Internal quotation overview table.
- `/admin/crm/leads/[id]?tab=quotations` — Lead detail panel quotation tab.
- `/admin/quotations/[id]/draft` — Interactive quotation draft editor.

### 13.2 Server Module Structure
- `src/features/quotations/server/quotation-draft-actions.ts` — Server actions (`createDraft`, `updateDraftItems`, `archiveDraft`).
- `src/features/quotations/server/quotation-queries.ts` — Read queries (`getQuotationDraft`, `listLeadQuotations`).
- `src/features/quotations/contracts/types.ts` — DTO contracts.

### 13.3 UI Editor Component Hierarchy
- `QuotationDraftEditor` (Main Container with optimistic state & `lock_version` check)
  - `QuotationHeaderCard` (Title, Client/Property Snapshot)
  - `QuotationSectionAccordion` (Room/Area grouping)
    - `QuotationLineItemTable` (Item descriptions, quantity, UOM, unit rate, line total)
  - `QuotationDiscountCard` (Type, Value/Percentage, Calculated Discount)
  - `QuotationPaymentScheduleEditor` (Milestones & Percentages/Amounts)
  - `QuotationTermsEditor` (Inclusions, Exclusions, Terms & Conditions)
  - `QuotationTotalsSummary` (Subtotal, Discount, Taxable Base, Tax, Grand Total)
  - `QuotationConflictBanner` (Rendered when `QUOTATION_VERSION_CONFLICT` occurs)

---

## 14. Test Matrix (For Future Implementation)

### 14.1 Database & pgTAP Tests (`0018_quotations_foundation_test.sql`)
- **AUTHORIZATION**:
  - Assigned Sales Executive can view/edit quotation for lead where `assigned_to = auth.uid()`.
  - Unassigned Sales Executive is DENIED access (`42501`).
  - Reassignment of `leads.assigned_to` immediately transfers quotation access.
  - Sales Manager & Super Admin have broad access.
  - Project Manager and Designer are DENIED access (`42501`).
  - Verification that `quotations.approve` permission DOES NOT exist in database.
- **DOMAIN & VERSIONING**:
  - `idx_one_current_draft_per_quotation` prevents two current drafts for same quotation.
  - Revision creation increments `version_number` monotonically.
  - Transactional `FOR UPDATE` lock prevents duplicate version generation during concurrent requests.
- **MONEY & ARITHMETIC**:
  - `line_total_paise` = `round(quantity * unit_rate_paise)`.
  - Over-discount (`discount_total_paise > subtotal_paise`) raises `QUOTATION_VALIDATION_FAILED`.
  - Synthetic test tax rate calculates `tax_total_paise` exactly.
  - `taxable_base_paise` equals `subtotal_paise - discount_total_paise`.
- **CONCURRENCY & IDEMPOTENCY**:
  - Stale `lock_version` raises `QUOTATION_VERSION_CONFLICT` (`P0002`).
  - `p_idempotency_key` replay returns previous result with `idempotentReplay = true`.
  - Reusing idempotency key with different payload raises `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`.
- **DELETION & IMMUTABILITY**:
  - Direct SQL `DELETE` by staff role raises permission denied.
  - FK delete restrict prevents cascading deletion.

---

## 15. Explicit Non-Actions & Entry Gate Summary

### 15.1 Non-Actions Enforced
- 🚫 **NO** M25 migration created or applied.
- 🚫 **NO** managed database DDL or SQL executed.
- 🚫 **NO** quotation runtime application code implemented.
- 🚫 **NO** approval workflows or `quotations.approve` permissions added.
- 🚫 **NO** PDF generation or storage bucket setup.
- 🚫 **NO** WhatsApp or Meta Cloud API integration calls.
- 🚫 **NO** client acceptance, rejection, or token logic.
- 🚫 **NO** Closed-Won lead lifecycle transitions or project creation.
- 🚫 **NO** production deployment or intake activation.

### 15.2 Final Phase 7A Architecture Status
```
PHASE_7A_ARCHITECTURE_FREEZE: PASS
UNRESOLVED_OWNER_DECISIONS: 5
M25: NOT CREATED
MANAGED_WRITE: NONE
PHASE_7A_IMPLEMENTATION: NOT STARTED
PHASE_7B: NOT STARTED
```
