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

## Technical Audit & Final UI-Only Correction Pass Summary

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

### 2. Final UI-Only Correction Pass Repairs
- **UI Raw Commercial Money Text & Canonical Paise Separation**:
  - `QuotationPaymentScheduleEditor.tsx`: Maintained raw amount text state (`RawMilestoneState`) per milestone. Invalid amount text (e.g. `1.999` or `abc`) displays inline validation and blocks `onSaveSchedule`. Invalid input cannot overwrite canonical `amountPaise` or silently become 0.
  - `QuotationSectionAccordion.tsx`: Maintained raw unit-rate text state (`RawLineItemState`) per item. Removed all invalid parse fallbacks (`?? 0`). Invalid unit-rate text displays inline validation and blocks `onSaveSections`.
  - `QuotationDiscountCard.tsx`: Maintained raw discount string state (`rawFlatDiscount`, `rawPercentageDiscount`) and added explicit `Apply Discount` commit action. Invalid discount text displays inline validation and blocks `onUpdateDiscount` callback invocation.
- **Pure Editor Validation Helper**: Created `src/features/quotations/utils/quotation-editor-helpers.ts` containing pure validation and payload construction functions (`buildValidatedPaymentSchedulePayload`, `buildValidatedSectionPayload`, `validateFlatDiscountInput`, `validatePercentageDiscountInput`).
- **Zero Floating-Point Parsers Guard**: Verified 0 calls to `parseFloat`, `Number.parseFloat`, `parseInrToPaise`, or `?? 0` in quotation UI components and server actions.
- **CRM Active Draft RBAC Gating**: `LeadDetailQuotationPanel.tsx` strictly requires `canEditQuotation` (`quotations.edit`) to open an existing active draft. `canCreateQuotation` (`quotations.create`) alone cannot open an active draft.
- **Frozen C0 Contract Reference**: `src/features/quotations/contracts/line-item.ts` defines `QUOTATION_QUANTITY_MILLI_MAX = 1_000_000_000` (max quantity = 1,000,000.000 units), which is enforced by repository migration M25 and `quotation-decimal-utils.ts`.

### 3. QA Verification Matrix
- **Database Quality Gate (`npm run check:db`)**: 18/18 test files PASS (100% SUCCESS; 723/723 subtests passed, including 69/69 in `18_quotation_draft_foundation_test.sql`).
- **Phase 7A Unit Tests (`npm run test:phase-7a`)**: PASS (28/28 tests passed: 10 in `phase-7-c0-contracts.test.ts`, 18 in `phase-7a-quotation-draft.test.ts`).
- **Application Unit Tests (`npm run test:app`)**: PASS (579/579 tests passed).
- **TypeScript Typecheck**: `npm run typecheck` PASS (0 errors).
- **Application Lint & Build**: `npm run check` PASS (0 lint errors, Next.js build succeeded).
- **Managed Supabase Status**: Verified M1–M24 baseline (`lpurlfmpvriyvpkujvyl`); M25 remains 100% UNAPPLIED to managed Supabase.

---

## Compliance & Governance Checklist

- [x] 1:1 lead ↔ quotation root cardinality enforced (`quotations.lead_id` UNIQUE).
- [x] Monotonic version numbering and `lock_version` optimistic concurrency implemented.
- [x] All money calculations performed in canonical INR integer paise (zero floating-point drift).
- [x] UI raw commercial money text separated from canonical paise state across all quotation editor components.
- [x] Invalid/blank/over-scale money text cannot mutate to 0 or persist (callbacks blocked until exact parsing succeeds).
- [x] Zero `parseFloat`, `Number.parseFloat`, `parseInrToPaise`, or `?? 0` fallbacks in quotation mutation paths.
- [x] Quantity max bound aligned with frozen C0 contract (`1,000,000.000` units).
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
