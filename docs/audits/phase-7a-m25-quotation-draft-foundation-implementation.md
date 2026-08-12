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

## Technical Audit & Final Pre-Apply Consistency Sweep Summary

### 1. Database Schema & M25 Migration Foundation
- **Migration File**: `supabase/migrations/20260812140000_commercial_quotation_draft_foundation.sql`
- **Schema Additions**:
  - `public.quotations`: 1:1 root identity table with `lead_id` UNIQUE constraint.
  - `public.quotation_tax_profiles`: Catalogue for Super-Admin governed tax profiles (0 production seeds in M25).
  - `public.quotation_versions`: Monotonic version ledger with `lock_version` optimistic concurrency, canonical money integers in INR paise, partial unique index `idx_one_current_draft_per_quotation`.
  - `public.quotation_sections`: Room/area layout blocks with section subtotal paise. Section name constraint aligned to 120 characters (`chk_quotation_sections_name`).
  - `public.quotation_items`: Line items with explicit unit of measure (mandatory 1..30 chars), quantity numeric(10,3) (bounded (0, 1000000.000]), unit rate in paise, line total in paise, and description/specifications bounds (<=2000 chars each).
  - `public.quotation_payment_schedules`: Draft payment milestone schedule supporting schedule-level percentage or amount mode.
  - `public.quotation_events`: Append-only commercial quotation domain event ledger protected with `private.forbid_append_only_mutation()`.
  - `private.quotation_idempotency_requests`: Private idempotency ledger with `UNIQUE(actor_id, operation_code, idempotency_key)` and SHA-256 request payload verification.
  - `private.quotation_number_seq`: Monotonic sequence allocator yielding sequence format `OD-Q-{YYYY}-{SEQ6}` (Asia/Kolkata timezone).

### 2. Pre-Apply Consistency Sweep Repairs
- **Section Name Max Length Alignment (120 Chars)**:
  - `buildValidatedSectionPayload()` in `quotation-editor-helpers.ts`: Fixed max length check from 150 to **120** characters, establishing exact parity with database DDL (`chk_quotation_sections_name`) and RPC PL/pgSQL assertions.
- **Description & Specifications Bounds (<= 2000 Chars)**:
  - `buildValidatedSectionPayload()` and M25 RPC `save_quotation_draft_items`: Added explicit length validation for line item `description` (<= 2000 chars) and `specifications` (<= 2000 chars), raising `QUOTATION_VALIDATION_FAILED` (P0001).
- **Numeric Overflow Protection in PL/pgSQL RPCs**:
  - M25 RPCs (`save_quotation_draft_items`, `replace_quotation_payment_schedule`, `update_quotation_draft`): Parse raw JSON numbers into unrestricted `numeric` variables first, validate bounds, and raise `QUOTATION_VALIDATION_FAILED` (P0001) instead of raw Postgres `22003` overflow errors. Use unrestricted `v_pct_sum numeric := 0;` for percentage accumulator.
- **No-Fake-Default Neutral Editor State**:
  - `QuotationSectionAccordion.tsx`: New section starts with `sectionName: ""`. New item starts with `itemName: ""`, `rawQuantity: ""`, `unitOfMeasure: ""`, `rawUnitRate: ""`. Visual guidance provided via input `placeholder` attributes (`e.g. Living Room`, `e.g. TV Unit`).
  - `QuotationPaymentScheduleEditor.tsx`: New milestone starts with `milestoneName: ""`, `rawPercentage: ""`, `rawAmount: ""`. Visual guidance provided via input `placeholder` attributes (`e.g. Advance Booking`, `e.g. 20.00`).
- **Header Keystroke Isolation & Explicit Save**:
  - `QuotationHeaderCard.tsx`: Isolate typing into local `rawTitle` and `rawScopeSummary` React state. Removed per-keystroke server action dispatches. Added explicit **"Save Title & Scope"** button with length validation (title 1..200, scope <= 2000). Resyncs local state from canonical `version` prop during render.
- **Terms Editor Resync**:
  - `QuotationTermsEditor.tsx`: Resyncs local state (`terms`, `inclusions`, `exclusions`) during render when canonical `version` prop changes.
- **Generated Types RPC Idempotency Signature Parity**:
  - `src/types/database.generated.ts`: Added optional `p_idempotency_key?: string` to `Args` of `update_quotation_draft`, `save_quotation_draft_items`, and `replace_quotation_payment_schedule`.
- **Archived Quotation UI Safety**:
  - `src/app/admin/quotations/[quotationId]/draft/page.tsx`: Blocks mutation editor for archived or inactive quotation versions and renders read-only notice banner.

### 3. QA Verification Matrix
- **Database Quality Gate (`npm run check:db`)**: 18/18 test files PASS (100% SUCCESS; 730/730 subtests passed, including 76/76 in `18_quotation_draft_foundation_test.sql`).
- **Phase 7A Unit Tests (`npm run test:phase-7a`)**: PASS (38/38 tests passed: 10 in `phase-7-c0-contracts.test.ts`, 28 in `phase-7a-quotation-draft.test.ts`).
- **Application Unit Tests (`npm run test:app`)**: PASS (589/589 tests passed).
- **TypeScript Typecheck (`npm run typecheck`)**: PASS (0 errors).
- **Application Quality Gate (`npm run check`)**: PASS (0 lint errors, 0 type errors, Next.js Turbopack build succeeded with 49 static/dynamic routes).
- **Managed Supabase Status**: Verified M1–M24 baseline (`lpurlfmpvriyvpkujvyl`); M25 remains 100% UNAPPLIED to managed Supabase.

---

## Compliance & Governance Checklist

- [x] Section name length limit aligned to 120 chars across DDL, RPC, and TypeScript helper.
- [x] Description (<= 2000) and specifications (<= 2000) length validated in UI helper and RPC.
- [x] Raw Postgres 22003 numeric overflow prevented with unrestricted numeric parsing in PL/pgSQL RPCs.
- [x] Mandatory UOM enforced; blank UOM rejected with validation error.
- [x] Zero fabricated UOM defaults (`"nos"`, `"sqft"`) in editor helpers or UI state.
- [x] New sections, items, and milestones initialize with neutral blank strings (`""`).
- [x] Header keystrokes isolated from server calls; explicit Save button requires manual user commit.
- [x] Header and Terms components resync local state when canonical version prop changes.
- [x] Generated DB types include optional `p_idempotency_key` on update/save/schedule RPCs.
- [x] Archived/inactive quotation versions block draft editor UI with read-only notice banner.
- [x] 1:1 lead ↔ quotation root cardinality enforced (`quotations.lead_id` UNIQUE).
- [x] Monotonic version numbering and `lock_version` optimistic concurrency implemented.
- [x] All money calculations performed in canonical INR integer paise (zero floating-point drift).
- [x] Zero `parseFloat`, `Number.parseFloat`, `parseInrToPaise`, `?? 0`, `|| "nos"`, or `|| "sqft"` fallbacks in quotation mutation paths.
- [x] Sales ownership pointer evaluated via `leads.assigned_to = auth.uid()` (assigned sales executive scope).
- [x] Durable idempotency ledger `private.quotation_idempotency_requests` implemented.
- [x] Append-only event audit ledger `public.quotation_events` protected against UPDATE and DELETE.
- [x] Managed Supabase database `lpurlfmpvriyvpkujvyl` remains M1–M24 (ZERO managed DDL/DML executed).
