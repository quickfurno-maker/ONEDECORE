# ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation Implementation Audit

## Executive Summary

- **Phase**: Phase 7A — Commercial Quotation Data & Draft Foundation Implementation
- **Repository**: `quickfurno-maker/ONEDECORE`
- **Worktree**: `C:\Users\KESHAV SHARMA\Desktop\OneDecore-phase6c`
- **Protected Main Baseline**: `a768e33203c5971892944d0f689540d5ee7e173f`
- **Starting HEAD SHA**: `62c6197985b8cd41c3e485799e2bfd22b6caaff7`
- **Implementation Branch**: `phase-7a-m25-quotation-draft-foundation`
- **Managed Supabase Project**: `lpurlfmpvriyvpkujvyl` (`ap-south-1`)
- **Managed Migration Baseline**: `M1–M24` (M25 strictly absent from managed database)
- **Repository Migration Baseline**: `M1–M25` (M26 strictly absent)
- **PR Status**: PR #53 OPEN / DO NOT MERGE

---

## Technical Audit & Surgical Correction Pass Summary

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

### 2. Surgical Correction Pass Repairs
- **Exact Decimal String Transport**: Authoritative mutation paths for decimal quantities and percentages transport exact validated strings (`quantity`, `percentage`) without `parseFloat` binary floating-point conversion drift. Pure scalar validator module `src/features/quotations/server/quotation-decimal-utils.ts` enforces scale limits before RPC payload construction.
- **Update RPC Idempotency Hash NULL vs [] Distinction**: `update_quotation_draft` encodes SQL `NULL` as JSON `null` and empty arrays as `[]` for `inclusions` and `exclusions`, preserving semantic payload distinction. Replaying identical payload returns `idempotentReplay: true`; changing any field with an existing key raises `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`.
- **Precision & Scale Hardening**: Quantity values destined for `numeric(10,3)` reject > 3 decimal places. Percentage values destined for `numeric(5,2)` reject > 2 decimal places. Over-scale inputs raise controlled `QUOTATION_VALIDATION_FAILED` (`P0001`), not raw SQL `22P02`.
- **CRM Active Draft RBAC Gating**: `LeadDetailQuotationPanel.tsx` strictly requires `canEditQuotation` (`quotations.edit`) to open an existing active draft. `canCreateQuotation` (`quotations.create`) alone cannot open an active draft.
- **64-bit Transaction Advisory Locking**: All transaction advisory locks for quotation root/idempotency use deterministic 64-bit `hashtextextended(..., 0)`.
- **Real Error Object Normalization**: `quotationErrorFromPostgresMessage` normalizes plain Supabase error objects (`{ code, message, details, hint }`), mapping `P0002` to `QUOTATION_VERSION_CONFLICT`, `42501` to `QUOTATION_NOT_FOUND_OR_FORBIDDEN`, and sanitizing unknown errors to `QUOTATION_UNKNOWN_ERROR`.

### 3. QA Verification Matrix
- **pgTAP Database Tests**: 18/18 test files PASS (100% SUCCESS; 720/720 subtests passed, including 66/66 in `18_quotation_draft_foundation_test.sql`).
- **Phase 7A Unit Tests**: `npm run test:phase-7a` PASS (23/23 tests passed).
- **Application Unit Tests**: `npm run test:app` PASS (574/574 tests passed).
- **TypeScript Typecheck**: `npm run typecheck` PASS (0 errors).
- **Application Lint & Build**: `npm run check` PASS (0 lint errors, Next.js build succeeded).
- **Managed Supabase Status**: Verified M1–M24 baseline (`lpurlfmpvriyvpkujvyl`); M25 remains 100% UNAPPLIED to managed Supabase.

---

## Compliance & Governance Checklist

- [x] 1:1 lead ↔ quotation root cardinality enforced (`quotations.lead_id` UNIQUE).
- [x] Monotonic version numbering and `lock_version` optimistic concurrency implemented.
- [x] All money calculations performed in canonical INR integer paise (zero floating-point drift).
- [x] Exact decimal string transport used for quantities and percentages (zero `parseFloat` drift).
- [x] Sales ownership pointer evaluated via `leads.assigned_to = auth.uid()` (assigned sales executive scope).
- [x] Tax profile snapshotting implemented with null tax contract (unconfigured tax profile = incomplete draft).
- [x] Schedule-level payment mode (percentage vs amount) enforced per OD7A-2.
- [x] Durable idempotency ledger `private.quotation_idempotency_requests` implemented.
- [x] Update RPC idempotency hash distinguishes SQL `NULL` vs `[]` arrays.
- [x] Append-only event audit ledger `public.quotation_events` protected against UPDATE and DELETE.
- [x] System permissions `quotations.read`, `quotations.create`, `quotations.edit` granted to sales/management roles.
- [x] Existing active draft opening strictly requires `quotations.edit`.
- [x] `quotations.approve` and `quotations.delete` permissions strictly ABSENT.
- [x] Managed Supabase database `lpurlfmpvriyvpkujvyl` remains M1–M24 (ZERO managed DDL/DML executed).
