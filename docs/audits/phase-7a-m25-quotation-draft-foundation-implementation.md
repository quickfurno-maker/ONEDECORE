# ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation Implementation Audit

## Executive Summary

- **Phase**: Phase 7A — Commercial Quotation Data & Draft Foundation Implementation
- **Repository**: `quickfurno-maker/ONEDECORE`
- **Worktree**: `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase6c`
- **Protected Main Baseline**: `a768e33203c5971892944d0f689540d5ee7e173f`
- **Implementation Branch**: `phase-7a-m25-quotation-draft-foundation`
- **Managed Supabase Project**: `lpurlfmpvriyvpkujvyl` (`ap-south-1`)
- **Managed Migration Baseline**: `M1–M24` (M25 strictly absent from managed database)
- **Repository Migration Baseline**: `M1–M25` (M26 strictly absent)
- **PR Status**: PR #53 OPEN / DO NOT MERGE

---

## Technical Audit & Final Narrow Correction Pass Summary

### 1. Database Schema & M25 Migration Foundation
- **Migration File**: `supabase/migrations/20260812140000_commercial_quotation_draft_foundation.sql`
- **Schema Additions**:
  - `public.quotations`: 1:1 root identity table with `lead_id` UNIQUE constraint.
  - `public.quotation_tax_profiles`: Catalogue for Super-Admin governed tax profiles (0 production seeds in M25).
  - `public.quotation_versions`: Monotonic version ledger with `lock_version` optimistic concurrency, canonical money integers in INR paise, partial unique index `idx_one_current_draft_per_quotation`.
  - `public.quotation_sections`: Room/area layout blocks with section subtotal paise.
  - `public.quotation_items`: Line items with explicit unit of measure, quantity numeric(10,3) (bounded (0, 1000000.000]), unit rate in paise, and auto-calculated line total.
  - `public.quotation_payment_schedules`: Draft payment milestone schedule supporting schedule-level percentage or amount mode.
  - `public.quotation_events`: Append-only commercial quotation domain event ledger protected with `private.forbid_append_only_mutation()`.
  - `private.quotation_idempotency_requests`: Private idempotency ledger with `UNIQUE(actor_id, operation_code, idempotency_key)` and SHA-256 request payload verification.
  - `private.quotation_number_seq`: Monotonic sequence allocator yielding sequence format `OD-Q-{YYYY}-{SEQ6}` (Asia/Kolkata timezone).

### 2. Final Narrow Correction Pass Repairs
- **Quantity Bound Alignment with Frozen C0 Contract**: Aligned maximum quantity bound to `1,000,000.000` units (`1,000,000,000` milli-units derived directly from `QUOTATION_QUANTITY_MILLI_MAX` in `src/features/quotations/contracts/line-item.ts`). Updated `quotation-decimal-utils.ts` and `20260812140000_commercial_quotation_draft_foundation.sql` (`chk_quotation_items_qty` constraint `quantity > 0 and quantity <= 1000000.000`).
- **Strict Exact INR-to-Paise Parser (No Float / No Truncation)**: Implemented `parseQuotationInrToPaiseExact` in `src/features/quotations/contracts/money.ts`. Replaces all floating-point / `parseInrToPaise` usages in quotation UI (`QuotationPaymentScheduleEditor.tsx`, `QuotationSectionAccordion.tsx`, `QuotationDiscountCard.tsx`). Rejects malformed strings (`abc`, `-1`, `1e3`), invalid symbols, and over-scale decimals (> 2 decimal places e.g. `1.999`) returning `null` without silent truncation or default to 0.
- **Update RPC Idempotency Hash NULL vs [] Distinction**: `update_quotation_draft` encodes SQL `NULL` as JSON `null` and empty arrays as `[]` for both `inclusions` and `exclusions`. Verified with pgTAP tests for both `p_inclusions` and `p_exclusions` `NULL` vs `[]` mismatch.
- **CRM Active Draft RBAC Gating**: `LeadDetailQuotationPanel.tsx` strictly requires `canEditQuotation` (`quotations.edit`) to open an existing active draft. `canCreateQuotation` (`quotations.create`) alone cannot open an active draft.
- **Real Source Proofs & Phase 7B Absence Guard**: Replaced simulation tests in `phase-7a-quotation-draft.test.ts` with real source AST/file checks proving `QuotationDraftEditor.tsx` wiring, real permission constants (`quotations.read`/`create`/`edit`), and total absence of Phase 7B actions, RPCs, PDF generators, or approval workflows.

### 3. QA Verification Matrix
- **Database Quality Gate (`npm run check:db`)**: 18/18 test files PASS (100% SUCCESS; 723/723 subtests passed, including 69/69 in `18_quotation_draft_foundation_test.sql`).
- **Phase 7A Unit Tests (`npm run test:phase-7a`)**: PASS (24/24 tests passed: 10 in `phase-7-c0-contracts.test.ts`, 14 in `phase-7a-quotation-draft.test.ts`).
- **Application Unit Tests (`npm run test:app`)**: PASS (575/575 tests passed).
- **TypeScript Typecheck**: `npm run typecheck` PASS (0 errors).
- **Application Lint & Build**: `npm run check` PASS (0 lint errors, Next.js build succeeded).
- **Managed Supabase Status**: Verified M1–M24 baseline (`lpurlfmpvriyvpkujvyl`); M25 remains 100% UNAPPLIED to managed Supabase.

---

## Compliance & Governance Checklist

- [x] 1:1 lead ↔ quotation root cardinality enforced (`quotations.lead_id` UNIQUE).
- [x] Monotonic version numbering and `lock_version` optimistic concurrency implemented.
- [x] All money calculations performed in canonical INR integer paise (zero floating-point drift).
- [x] Exact decimal string transport used for quantities and percentages (zero `parseFloat` drift).
- [x] Quantity max bound aligned with frozen C0 contract (`1,000,000.000` units).
- [x] Exact INR to paise parser `parseQuotationInrToPaiseExact` rejects over-scale/invalid input without silent truncation or default to 0.
- [x] Sales ownership pointer evaluated via `leads.assigned_to = auth.uid()` (assigned sales executive scope).
- [x] Tax profile snapshotting implemented with null tax contract.
- [x] Schedule-level payment mode (percentage vs amount) enforced per OD7A-2.
- [x] Durable idempotency ledger `private.quotation_idempotency_requests` implemented.
- [x] Update RPC idempotency hash distinguishes SQL `NULL` vs `[]` arrays for both inclusions and exclusions.
- [x] Append-only event audit ledger `public.quotation_events` protected against UPDATE and DELETE.
- [x] System permissions `quotations.read`, `quotations.create`, `quotations.edit` granted to sales/management roles.
- [x] Existing active draft opening strictly requires `quotations.edit`.
- [x] `quotations.approve` and `quotations.delete` permissions strictly ABSENT.
- [x] Managed Supabase database `lpurlfmpvriyvpkujvyl` remains M1–M24 (ZERO managed DDL/DML executed).
