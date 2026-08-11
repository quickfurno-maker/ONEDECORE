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

## Technical Audit & Final Correction Pass Summary

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

### 2. Final Correction Pass Repairs
- **Update RPC Idempotency Hash**: `update_quotation_draft` constructs request hash from all mutable inputs (`quotationId`, `expectedLockVersion`, `title`, `scopeSummary`, `discountType`, `discountValuePaise`, `discountPercentage`, `taxProfileId`, `clearTaxProfile`, `termsAndConditions`, `inclusions`, `exclusions`) via deterministic JSONB hashing.
- **64-bit Transaction Advisory Locking**: Replaced all 32-bit `hashtext` advisory locks with 64-bit transaction advisory locks (`hashtextextended(..., 0)`).
- **Error Object Normalization**: `quotationErrorFromPostgresMessage` normalizes plain Supabase error objects (`{ code, message, details, hint }`), mapping `P0002` to `QUOTATION_VERSION_CONFLICT`, `42501` to `QUOTATION_NOT_FOUND_OR_FORBIDDEN`, and sanitizing unknown errors to `QUOTATION_UNKNOWN_ERROR`.
- **Exact Decimal Input Transport**: Exact decimal strings transported from UI and Server Actions to PostgreSQL RPCs (`quantity`, `percentage`), avoiding `parseFloat` binary floating-point conversion drift.
- **Payment Schedule Mode Isolation**: In `percentage` mode, non-null `amountPaise` is rejected with `QUOTATION_VALIDATION_FAILED`. In `amount` mode, non-null `percentage` is rejected with `QUOTATION_VALIDATION_FAILED`. Malformed scalar strings are rejected with controlled validation errors instead of raw syntax errors.
- **Canonical Draft Reload**: `getQuotationDraftAction` reads fresh `QuotationDraftDTO` without mutating DB. `QuotationDraftEditor.tsx` uses `handleRefreshDraft()` to replace local client state on demand and on stale lock conflict.
- **CRM Quotation RBAC Integration**: `LeadDetailQuotationPanel.tsx` uses explicit `quotations.create` and `quotations.edit` RBAC permissions derived from `probeQuotationPermissions()`, instead of CRM lead read capability.

### 3. QA Verification Matrix
- **pgTAP Database Tests**: 18/18 test files PASS (100% SUCCESS; 715/715 subtests passed, including 61/61 in `18_quotation_draft_foundation_test.sql`).
- **Phase 7A Unit Tests**: `npm run test:phase-7a` PASS (14/14 tests passed).
- **Application Unit Tests**: `npm run test:app` PASS (565/565 tests passed).
- **TypeScript Typecheck**: `npm run typecheck` PASS (0 errors).
- **Application Lint & Build**: `npm run check` PASS (0 lint errors, Next.js build succeeded).
- **Managed Supabase Status**: Verified M1–M24 baseline (`lpurlfmpvriyvpkujvyl`); M25 remains 100% UNAPPLIED to managed Supabase.

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
