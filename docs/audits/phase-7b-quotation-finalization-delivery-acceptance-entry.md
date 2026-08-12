# ONEDECORE Phase 7B Architecture Entry Audit & Contract Freeze

## Executive Summary
This document establishes the authoritative architecture freeze, archaeology audit, and contract specification for **ONEDECORE Phase 7B: Commercial Quotation Finalization, Premium PDF Generation, Secure WhatsApp Delivery & Client Acceptance**.

Phase 7B builds upon the fully merged, certified Phase 7A commercial quotation data plane and draft foundation (commit [`6e2426be8bee80ff6e6474b3f7c033ba506587b1`](file:///c:/Users/KESHAV%20SHARMA/Desktop/OneDecore-phase6c/docs/audits/phase-7b-quotation-finalization-delivery-acceptance-entry.md), migration M25).

This gate is **DOCUMENTATION ONLY**. No migration files (M26+), managed database schema mutations, or runtime source code modifications are included in this entry audit.

---

## 1. Entry Baseline & Scope

### Repository & Managed Database Baseline
- **Repository**: `quickfurno-maker/ONEDECORE`
- **Protected Main Entry SHA**: `6e2426be8bee80ff6e6474b3f7c033ba506587b1`
- **Phase 7A Merge Commit**: `6e2426be8bee80ff6e6474b3f7c033ba506587b1` (Parent 1: `a768e33203c5971892944d0f689540d5ee7e173f`, Parent 2: `509b52fd28bb1778d02ee3545ac284db91e8186d`)
- **Repository Migration Baseline**: M1–M25
- **Managed Supabase Project**: `lpurlfmpvriyvpkujvyl` (`ap-south-1`)
- **Managed Migration Baseline**: M1–M25 (`20260812140000_commercial_quotation_draft_foundation.sql` applied)
- **M25 Artifact Fingerprints**:
  - Git Blob SHA: `ce5e38a3431524679fff0c7f4551824fb3d982f8`
  - Raw SHA-256: `baf8e61e2a491a09f76422cc90215b77e0b353897e24ec4275ead229c5e33bc8`
- **M26**: Strictly **ABSENT**.

### Scope Inclusions (Phase 7B)
1. **Server-Authoritative Quotation Finalization**: Immutable version freezing, SHA-256 content hashing, strict transactional pre-validation (totals, hard discount validation, tax completeness, payment schedule absorption).
2. **Premium Commercial PDF Engine & Storage**: Server-side PDF rendering from frozen finalization state, immutable storage in private bucket `quotation-documents`, signed URL delivery.
3. **Phase 6B Secure Outbound Delivery**: Dispatch of finalized quotation notifications and PDF view links via existing `WHATSAPP_SERVICE` outbound infrastructure.
4. **Client Acceptance Capability & Portal**: Non-enumerating high-entropy capability tokens, client-facing acceptance portal, append-only acceptance audit, Closed-Won commercial prerequisite binding.
5. **Revision Lifecycle Management**: Controlled version incrementing (`OD-Q-YYYY-SEQ6` v1 -> v2), historical version immutability, acceptance capability re-issuance/revocation.

### Scope Exclusions (Forbidden in Phase 7B)
- 🚫 **NO** internal approval workflow, maker-checker flow, `Submitted for Approval` status, or `quotations.approve` permission.
- 🚫 **NO** project creation or Phase 8A handover execution.
- 🚫 **NO** production tax rate or discount bound default hardcoding.
- 🚫 **NO** direct Meta Graph API calls from quotation code (must route through Phase 6B `WHATSAPP_SERVICE`).
- 🚫 **NO** staff capability to execute client acceptance on behalf of client.

---

## 2. Source Provenance Matrix

| Source Identifier | File Path | Key Section / Symbol | Locked Rule Summary | Status | Phase 7B Implication |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADR-0020** | `docs/ADR/ADR-0020-closed-won-project-handover-invariants.md` | Closed-Won & Handover Invariants | Closed-Won requires accepted quotation; PM/Designer handover post-Closed-Won. | PARTIALLY SUPERSEDED | Approval workflow superseded by ADR-0022; Closed-Won commercial prerequisite remains binding. |
| **ADR-0022** | `docs/ADR/ADR-0022-v1-direct-quotation-finalization-and-send.md` | V1 Direct Authority | V1 has NO internal approval workflow; direct finalization/send by assigned Sales Exec; NO `quotations.approve`. | CURRENT & BINDING | Eliminates maker-checker friction; Sales Exec finalizes directly. |
| **DEC-0056** | `docs/10-decision-register.md` | Quotation Boundary | Commercial data plane separated from CRM lead identity; integer INR paise storage. | CURRENT & BINDING | Authoritative money stored in integer paise. |
| **DEC-0065** | `docs/10-decision-register.md` | Phase 7A Architecture Freeze | 1:1 lead-quotation root, schedule percentage/amount mode, `OD-Q-YYYY-SEQ6` sequence, Super Admin tax/discount bounds. | CURRENT & BINDING | M25 draft data plane baseline frozen. |
| **M25 Migration** | `supabase/migrations/20260812140000_...sql` | M25 Data Plane | `quotations`, `quotation_versions`, `quotation_sections`, `quotation_items`, `quotation_payment_schedules`, `quotation_events`. | CURRENT & BINDING | Phase 7A database tables and RLS baseline. |
| **Phase 6B Outbound** | `docs/08-whatsapp-and-n8n-boundary.md` | `WHATSAPP_SERVICE` Outbound | All WhatsApp messages dispatched via controlled Phase 6B outbound intent. | CURRENT & BINDING | Delivery must use `WHATSAPP_SERVICE` outbound queue. |

---

## 3. Contradiction & Archaeology Audit

A comprehensive codebase search was conducted across all documentation, database migrations, and application source code:
1. **Internal Approval Search**: `quotations.approve`, `Submitted for Approval`, `Approved`, `maker-checker`.
   - **Result**: Confirmed 0 active runtime usage. ADR-0020 approval language was explicitly superseded by ADR-0022. `18_quotation_draft_foundation_test.sql` explicitly asserts `quotations.approve` does NOT exist in permission catalogue.
2. **Phase 6B Direct Outbound Search**: Verified zero direct calls to Meta Graph API outside `src/features/whatsapp/server/`. Quotation delivery will interface strictly with Phase 6B intent dispatch.

---

## 4. Locked Business & Architecture Rules

1. **NO Internal Approval**: V1 quotation lifecycle operates as: `Draft` → `Finalized` → `Sent` → `Accepted` / `Revised`. No `quotations.approve` permission or approval table shall be created.
2. **Sales Authority**: Assigned Sales Executive is the V1 commercial operator for assigned leads, subject to `quotations.edit` and `quotations.send` permissions.
3. **Server-Authoritative Finalization**: Transactional freezing of quotation draft into an immutable `finalized` version with a SHA-256 payload digest.
4. **Hard Discount & Tax Boundary**:
   - Hard maximum discount percentage is configured by Super Admin (production value remains UNSET).
   - Tax profile catalogue is configured by Super Admin (production value remains UNSET; no fake default GST).
   - Finalization snapshot freezes selected tax profile rates into the version record.
5. **Payment Schedule Absorption**: Last ordered milestone in percentage schedule absorbs residual paise to guarantee `sum(milestones) == grand_total_paise`.
6. **Unique Lead Cardinality**: Exactly 1 quotation root per lead (`quotations.lead_id` UNIQUE).
7. **Secure Non-Enumerating Client Capability**: Acceptance portal accessed via high-entropy token (`/q/[token]`). Tokens map to exact finalized version.
8. **Closed-Won Commercial Binding**: CRM lead transition to `Closed-Won` requires 1 authoritative accepted quotation version (`taxable_base_paise` forms sales achievement basis, excluding GST).

---

## 5. Domain State Model & Lifecycle

```
 +------------------+           Finalize RPC          +----------------------+
 |   DRAFT (v1)     | -----------------------------> |   FINALIZED (v1)     |
 | (Mutable Draft)  |                                | (Immutable Version)  |
 +------------------+                                +----------------------+
          ^                                                     |
          | Create Revision                                     | Generate PDF & Send
          |                                                     v
 +------------------+                                +----------------------+
 |   DRAFT (v2)     |                                |  SENT / DELIVERED    |
 | (Mutable Draft)  |                                | (Client Capability)  |
 +------------------+                                +----------------------+
                                                                |
                                                                | Client Accept
                                                                v
                                                     +----------------------+
                                                     |    ACCEPTED (v1)     |
                                                     | (Closed-Won Ready)   |
                                                     +----------------------+
```

---

## 6. Conceptual Database & Storage Plan (Phase 7B Forward-Only Migration Concept)

> [!IMPORTANT]
> The following schema extensions are **CONCEPTUAL** for Phase 7B design and WILL NOT be created in this docs-only gate.

### Conceptual Tables & Columns (Forward-Only Migration Concept)
1. **`public.quotation_versions` extensions**:
   - `status`: `draft` | `finalized` | `archived`
   - `finalized_at`: `TIMESTAMPTZ`
   - `finalized_by`: `UUID` (FK `auth.users`)
   - `content_sha256`: `TEXT`
   - `tax_profile_snapshot`: `JSONB`
2. **`public.quotation_pdf_documents`**:
   - `id`: `UUID` (PK)
   - `quotation_id`: `UUID` (FK `quotations`)
   - `version_id`: `UUID` (FK `quotation_versions`)
   - `bucket_id`: `TEXT` (`quotation-documents`)
   - `file_path`: `TEXT`
   - `file_size_bytes`: `BIGINT`
   - `sha256_hash`: `TEXT`
   - `created_at`: `TIMESTAMPTZ`
3. **`public.quotation_access_grants`**:
   - `id`: `UUID` (PK)
   - `quotation_id`: `UUID` (FK `quotations`)
   - `version_id`: `UUID` (FK `quotation_versions`)
   - `capability_token_hash`: `TEXT` (UNIQUE, SHA-256 hashed token)
   - `expires_at`: `TIMESTAMPTZ`
   - `revoked_at`: `TIMESTAMPTZ`
   - `created_at`: `TIMESTAMPTZ`
4. **`public.quotation_acceptances`**:
   - `id`: `UUID` (PK)
   - `quotation_id`: `UUID` (FK `quotations`)
   - `version_id`: `UUID` (FK `quotation_versions` UNIQUE per lead)
   - `accepted_by_name`: `TEXT`
   - `accepted_by_email`: `TEXT`
   - `accepted_at`: `TIMESTAMPTZ`
   - `user_agent`: `TEXT`

---

## 7. Material Owner Decisions Analysis

The following 6 material architecture decisions are submitted to the owner for formal review and locking:

### Decision OD7B-1: Client Acceptance Capability Token Expiry Policy
- **Context**: Defines whether a client acceptance URL capability token automatically expires after a fixed time window.
- **Options**:
  - *Option A*: Fixed 30-day expiration window.
  - *Option B (RECOMMENDED)*: Capability token remains active until a new quotation revision is issued or the token is explicitly revoked.
- **Rationale**: Aligns with custom interior commercial cycles; finalization snapshots freeze all commercial terms so price integrity is preserved regardless of token age.
- **Proposed Lock Wording**: *"Client acceptance capability tokens remain active for the finalized version until a new revision is issued or the token is explicitly revoked by authorized staff."*

### Decision OD7B-2: Token Revocation / Rotation on Revision Creation
- **Context**: Defines whether issuing a new draft revision automatically invalidates previous client acceptance capability tokens.
- **Options**:
  - *Option A (RECOMMENDED)*: Issuing a new quotation revision automatically revokes active client acceptance tokens for previous unaccepted versions.
  - *Option B*: Older version tokens remain acceptable until manually revoked.
- **Rationale**: Prevents a client from accidentally accepting an outdated commercial draft after a new revision has been requested.
- **Proposed Lock Wording**: *"Creating a new quotation revision automatically revokes client acceptance capability for all previous unaccepted versions of that quotation."*

### Decision OD7B-3: Premium PDF Storage & Delivery Access Model
- **Context**: Defines how generated quotation PDF documents are stored and served to clients.
- **Options**:
  - *Option A (RECOMMENDED)*: Store PDFs in private Supabase Storage bucket `quotation-documents`; serve to clients via short-lived signed URLs (15-minute TTL) generated on-demand by the acceptance portal.
  - *Option B*: Store PDFs in a public storage bucket with unauthenticated URLs.
- **Rationale**: Option A prevents public URL enumeration and unauthorized document harvesting while providing seamless client access.
- **Proposed Lock Wording**: *"Quotation PDF documents are stored in private bucket quotation-documents and delivered via short-lived signed URLs generated on-demand through authenticated or valid capability sessions."*

### Decision OD7B-4: PDF Immutable Caching & Regeneration Policy
- **Context**: Defines whether PDFs are re-rendered on every view or cached immutably upon finalization.
- **Options**:
  - *Option A (RECOMMENDED)*: PDF is rendered once upon finalization, hashed, and immutably stored; re-rendering occurs only if a new version is finalized.
  - *Option B*: PDF is dynamically rendered on every client download request.
- **Rationale**: Guarantees absolute byte-for-byte fidelity between the stored PDF artifact, the database record, and what the client views.
- **Proposed Lock Wording**: *"Quotation PDFs are generated once per finalized version, hashed, and stored immutably. Re-rendering of existing finalized versions is prohibited."*

### Decision OD7B-5: Post-Acceptance Revision Handling & Closed-Won Invariant
- **Context**: Defines behavior if a customer requests changes after a quotation version has already been accepted and marked Closed-Won.
- **Options**:
  - *Option A (RECOMMENDED)*: Revisions created after acceptance produce a new draft version, but the previously accepted version remains the active Closed-Won commercial baseline until the new revision is finalized and accepted.
  - *Option B*: Creating a revision post-acceptance immediately reverts lead stage out of Closed-Won.
- **Rationale**: Protects sales achievement and contract stability while allowing commercial change orders.
- **Proposed Lock Wording**: *"Creating a revision after client acceptance does not invalidate the existing accepted quotation or Closed-Won baseline until the new revision is explicitly finalized and accepted."*

### Decision OD7B-6: Broad-Scope Sales Authority Boundaries
- **Context**: Defines which staff roles possess authority to finalize, generate PDF, send, and revise commercial quotations.
- **Options**:
  - *Option A (RECOMMENDED)*: Super Admin and assigned Sales Executive possess finalize/send/revise authority for assigned leads. PMs, Designers, and Kriti possess 0 finalize/send/revise authority.
  - *Option B*: PMs and Designers can finalize quotations.
- **Rationale**: Enforces strict commercial accountability and aligns with V1 RBAC model.
- **Proposed Lock Wording**: *"Finalization, PDF generation, WhatsApp delivery, and revision creation are restricted to Super Admin and active assigned Sales Executives (`quotations.edit` and `quotations.send`). PM, Designer, and Kriti roles possess zero commercial mutation authority."*

---

## 8. Quality Gate Verification

Local verification on entry branch `phase-7b-architecture-entry`:
- **Phase 7A Tests (`npm run test:phase-7a`)**: 42/42 PASS
- **Database Tests (`npm run check:db`)**: 748/748 PASS (94/94 in M25 pgTAP)
- **App Unit Tests (`npm run test:app`)**: 593/593 PASS across 156 suites
- **Quality Check (`npm run check`)**: 0 lint errors, 11 warnings, 0 type errors, Next.js build SUCCESS
- **Git Hygiene (`git diff --check`)**: Clean (0 issues)

---

## 9. Managed Write Ledger

```text
MANAGED_READS: YES
MANAGED_SCHEMA_WRITE: NONE
MANAGED_DATA_WRITE: NONE
MANAGED_MIGRATION_WRITE: NONE
MANAGED_RESTORE: NONE
```

---

## 10. Exit Classification

```text
PHASE_7B_ARCHITECTURE_ENTRY: PASS
PHASE_7B_ARCHITECTURE_STATUS: PENDING_OWNER_DECISIONS
NEXT_OWNER_ACTION: LOCK PHASE 7B OWNER DECISIONS AS RECOMMENDED
```
