# ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation Implementation Audit

## Executive Summary

- **Phase**: Phase 7A — Commercial Quotation Data & Draft Foundation Implementation
- **Repository**: `quickfurno-maker/ONEDECORE`
- **Worktree**: `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase6c`
- **Protected Main Baseline**: `a768e33203c5971892944d0f689540d5ee7e173f`
- **Implementation Branch**: `phase-7a-m25-quotation-draft-foundation`
- **Managed Supabase Project**: `lpurlfmpvriyvpkujvyl` (`ap-south-1`)
- **Managed Migration Baseline**: `M1–M24` (M25 strictly absent from managed database in this turn)

---

## Technical Audit & Verification Summary

### 1. Database Schema & M25 Migration Foundation
- **Migration File**: `supabase/migrations/20260812140000_commercial_quotation_draft_foundation.sql`
- **Schema Additions**:
  - `public.quotations`: 1:1 root identity table with `lead_id` UNIQUE constraint.
  - `public.quotation_tax_profiles`: Catalogue for Super-Admin governed tax profiles (0 production seeds in M25).
  - `public.quotation_versions`: Monotonic version ledger with `lock_version` optimistic concurrency, canonical money integers in INR paise, partial unique index `idx_one_current_draft_per_quotation`.
  - `public.quotation_sections`: Room/area layout blocks with section subtotal paise.
  - `public.quotation_items`: Line items with explicit unit of measure, quantity numeric(10,3), unit rate in paise, and auto-calculated line total.
  - `public.quotation_payment_schedules`: Draft payment milestone schedule supporting schedule-level percentage or amount mode.
  - `public.quotation_events`: Append-only commercial quotation domain event ledger protected with `private.forbid_append_only_mutation()`.
  - `private.quotation_idempotency_requests`: Private idempotency ledger with `UNIQUE(actor_id, operation_code, idempotency_key)` and SHA-256 request payload verification.
  - `private.quotation_number_seq`: Monotonic sequence allocator yielding sequence format `OD-Q-{YYYY}-{SEQ6}` (Asia/Kolkata timezone).

### 2. Transactional RPC API Foundation
- `public.create_quotation_draft`: Creates initial quotation draft or reactivates archived root to allocate next version under existing root. Enforces durable idempotency and snapshots CRM contact & property metadata.
- `public.save_quotation_draft_items`: Atomic replacement of sections and items with expected `lock_version` check, line item multiplication, section subtotal summation, and version total recalculation.
- `public.update_quotation_draft`: Mutates proposal title, scope summary, discount type/value, tax profile snapshot, terms, inclusions, and exclusions. Validates discount invariants (`discount_total_paise <= subtotal_paise`).
- `public.replace_quotation_payment_schedule`: Replaces payment milestones for percentage or amount mode. Reconciles percentage sum (100.00%) and derives milestone amounts with final milestone absorbing residual paise.
- `public.archive_quotation_draft`: Archives active draft version and quotation root.
- `public.get_quotation_draft`: Reads complete canonical QuotationDraftDTO for caller.

### 3. Application & Draft UI Workspace Layer
- `src/features/quotations/contracts/types.ts`: DTO interfaces and type contracts.
- `src/features/quotations/server/quotation-errors.ts`: Normalization of Postgres/RPC errors to stable domain errors (`QUOTATION_NOT_FOUND_OR_FORBIDDEN`, `QUOTATION_VERSION_CONFLICT`, `QUOTATION_VALIDATION_FAILED`, `QUOTATION_DRAFT_ALREADY_EXISTS`, `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`).
- `src/features/quotations/server/quotation-draft-actions.ts`: Server Actions (`createQuotationDraftAction`, `updateQuotationDraftAction`, `saveQuotationDraftItemsAction`, `replaceQuotationPaymentScheduleAction`, `archiveQuotationDraftAction`).
- `src/features/quotations/server/quotation-queries.ts`: Read queries (`getQuotationDraftByQuotationId`, `getQuotationDraftByLeadId`, `listLeadQuotations`, `listActiveTaxProfiles`).
- Interactive UI Components:
  - `QuotationDraftEditor.tsx` (Main container with `lock_version` conflict banner & optimistic updates).
  - `QuotationHeaderCard.tsx` (Title, scope, client snapshot, tax profile selector).
  - `QuotationSectionAccordion.tsx` (Room layout & line item table).
  - `QuotationDiscountCard.tsx` (Discount mode toggle & value inputs).
  - `QuotationPaymentScheduleEditor.tsx` (Milestone percentage/amount mode editor).
  - `QuotationTermsEditor.tsx` (Inclusions, exclusions, terms text block).
  - `QuotationTotalsSummary.tsx` (Subtotal, Discount, Taxable Base / Sales Achievement Basis, Tax, Grand Total summary).
- Admin Pages:
  - `/admin/quotations` (Overview table).
  - `/admin/quotations/[quotationId]/draft` (Draft editor workspace page).
  - Navigation: Added Quotations link to Admin Layout navbar.

### 4. QA Verification Results
- **pgTAP Database Tests**: 18/18 test files PASS (100% SUCCESS; 685/685 subtests passed, including `18_quotation_draft_foundation_test.sql`).
- **Application Unit Tests**: `npm run test:phase-7a` PASS (14/14 tests passed).
- **TypeScript Typecheck**: `npm run typecheck` PASS (0 errors).
- **Production Application Build**: `npm run build` PASS (All routes including `/admin/quotations` and `/admin/quotations/[quotationId]/draft` compiled cleanly).
- **Managed Supabase Status**: Verified M1–M24 baseline; M25 remained 100% UNAPPLIED to managed Supabase.

---

## Compliance & Governance Checklist

- [x] 1:1 lead ↔ quotation root cardinality enforced (`quotations.lead_id` UNIQUE).
- [x] Monotonic version numbering and `lock_version` optimistic concurrency implemented.
- [x] All money calculations performed in canonical INR integer paise (zero floating-point drift).
- [x] Sales ownership pointer evaluated via `leads.assigned_to = auth.uid()` (assigned sales executive scope).
- [x] Tax profile snapshotting implemented with null tax contract (unconfigured tax profile = incomplete draft).
- [x] Schedule-level payment mode (percentage vs amount) enforced per OD7A-2.
- [x] Durable idempotency ledger `private.quotation_idempotency_requests` implemented.
- [x] Append-only event audit ledger `public.quotation_events` protected against UPDATE and DELETE.
- [x] System permissions `quotations.read`, `quotations.create`, `quotations.edit` granted to sales/management roles.
- [x] `quotations.approve` and `quotations.delete` permissions strictly ABSENT.
- [x] Managed Supabase database `lpurlfmpvriyvpkujvyl` remains M1–M24 (ZERO managed DDL/DML executed).
