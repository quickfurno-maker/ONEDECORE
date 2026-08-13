# ONEDECORE Phase 7B Architecture Entry Audit & Contract Freeze

## Executive Summary
This document establishes the authoritative, source-faithful architecture freeze, expanded archaeology audit, and complete contract specification for **ONEDECORE Phase 7B: Commercial Quotation Finalization, Premium PDF Generation, Secure WhatsApp Delivery & Client Acceptance**.

Phase 7B builds upon the fully merged, certified Phase 7A commercial quotation data plane and draft foundation (protected main entry commit [`6e2426be8bee80ff6e6474b3f7c033ba506587b1`](file:///c:/Users/KESHAV%20SHARMA/Desktop/OneDecore-phase6c/docs/audits/phase-7b-quotation-finalization-delivery-acceptance-entry.md), migration M25).

This gate is **DOCUMENTATION ONLY — OWNER DECISIONS LOCKED**. All six material Phase 7B architecture decisions (OD7B-1 through OD7B-6) have been formally locked by the owner under authorization: `LOCK PHASE 7B OWNER DECISIONS AS RECOMMENDED`. No migration files (M26+), managed database schema mutations, or runtime source code modifications are included in this document freeze pass.

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
1. **Server-Authoritative Quotation Finalization**: Immutable version freezing, SHA-256 canonical content hashing, strict transactional pre-validation (totals re-calculation in paise, hard discount validation, tax snapshotting, payment schedule last-milestone residual paise absorption).
2. **Premium Commercial PDF Engine & Storage**: Server-side PDF rendering from frozen finalization state, immutable storage in private bucket `quotation-documents`, signed URL delivery (15-min TTL).
3. **Phase 6B Secure Outbound Delivery**: Dispatch of finalized quotation notifications and PDF view links via existing `WHATSAPP_SERVICE` outbound infrastructure.
4. **Client Acceptance & Atomic Closed-Won Transaction**: Client portal (`/q/[token]`), non-enumerating capability tokens, client acceptance transaction that atomically transitions the associated CRM lead to `Closed-Won`, snapshots `credited_sales_executive_id` at the acceptance instant, interprets `accepted_at` in `Asia/Kolkata` for sales achievement month, and enforces `taxable_base_paise` (GST excluded) as the sales achievement revenue basis.
5. **Pre-Acceptance Revision Management**: Controlled version incrementing (`OD-Q-YYYY-SEQ6` v1 -> v2), historical version immutability, acceptance capability re-issuance/revocation.

### Scope Exclusions (Forbidden in Phase 7B)
- 🚫 **NO** internal approval workflow, maker-checker flow, `Submitted for Approval` status, or `quotations.approve` permission.
- 🚫 **NO** staff capability to accept a quotation on behalf of a client (no staff `quotations.accept`).
- 🚫 **NO** project creation or Phase 8A handover execution.
- 🚫 **NO** production tax rate or discount bound default hardcoding.
- 🚫 **NO** direct Meta Graph API calls from quotation code (must route through Phase 6B `WHATSAPP_SERVICE`).

---

## 2. Authoritative Source Provenance Matrix

| Source Identifier | File Path | Key Section / Symbol | Locked Rule Summary | Classification | Phase 7B Implication |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADR-0020** | `docs/ADR/ADR-0020-closed-won-project-handover-invariants.md` | Closed-Won & Handover Invariants | Closed-Won requires accepted quotation; PM/Designer handover post-Closed-Won. | PARTIALLY SUPERSEDED | Approval workflow superseded by ADR-0022; Closed-Won commercial prerequisite remains binding. |
| **ADR-0022** | `docs/ADR/ADR-0022-v1-direct-quotation-finalization-and-send.md` | V1 Direct Authority & Acceptance | V1 has NO internal approval workflow. Sales Manager has broad sales scope; Sales Exec has assigned lead scope. Client acceptance path atomically drives Closed-Won. | CURRENT & BINDING | Finalize: `quotations.finalize`; Send: `quotations.send`; Edit: `quotations.edit`. Acceptance atomically drives Closed-Won and snapshots `credited_sales_executive_id`. |
| **CRM Boundary** | `docs/07-crm-and-quotation-boundary.md` | Commercial / CRM Boundary §3.3 | Commercial data plane isolated. Super Admin has full scope; Sales Manager has broad sales scope; Sales Exec has assigned lead scope. Accepted quotation drives Closed-Won. | CURRENT & BINDING | Role boundaries and atomic Closed-Won transition explicitly aligned with CRM data plane. |
| **DEC-0056** | `docs/10-decision-register.md` | Quotation Boundary | Commercial data plane isolated; integer INR paise storage. | CURRENT & BINDING | Authoritative money stored and calculated in integer paise. |
| **DEC-0065** | `docs/10-decision-register.md` | Phase 7A Architecture Freeze | 1:1 lead-quotation root, schedule percentage/amount mode, `OD-Q-YYYY-SEQ6` sequence, Super Admin tax/discount bounds. | CURRENT & BINDING | M25 draft data plane baseline frozen. |
| **DEC-0066 & Audit** | `docs/audits/phase-7a-m25-quotation-draft-foundation-implementation.md` | Implemented M25 Scope | Implemented permissions: `quotations.read`, `quotations.create`, `quotations.edit`. Reserved: `quotations.finalize`, `quotations.send`. | IMPLEMENTED BASELINE | M25 provides draft data plane; `quotations.finalize` and `quotations.send` reserved for Phase 7B. |
| **M25 Migration** | `supabase/migrations/20260812140000_...sql` | M25 Data Plane | `quotations`, `quotation_versions`, `quotation_sections`, `quotation_items`, `quotation_payment_schedules`, `quotation_events`. | IMPLEMENTED BASELINE | Phase 7A database tables, RLS, sequence, and idempotency ledger. |
| **Phase 6B Outbound** | `docs/08-whatsapp-and-n8n-boundary.md` & `src/features/whatsapp/server/` | `WHATSAPP_SERVICE` Outbound | WhatsApp messages dispatched strictly via Phase 6B outbound intent queue. | CURRENT & BINDING | Quotation delivery must enqueue `WHATSAPP_SERVICE` outbound intent; 0 direct Meta API calls. |
| **CRM Stage Mutation** | `src/features/crm/` | Closed-Won Transition | Closed-Won transition driven by client acceptance. Sales achievement basis = `taxable_base_paise` (GST excluded). | CURRENT & BINDING | Acceptance transaction atomically transitions CRM lead to Closed-Won and credits `taxable_base_paise`. |
| **Storage Conventions** | `docs/06-security-privacy-and-rls.md` | Private Storage Buckets | Private document storage bucket `quotation-documents`; signed URLs. | FUTURE PHASE BOUNDARY | PDF documents stored in private bucket `quotation-documents` with 15-min signed URLs. |
| **Phase 8A Handover** | `docs/09-phase-roadmap.md` | Project Creation Boundary | Project creation and PM handover execution begins ONLY post-Closed-Won in Phase 8A. | FUTURE PHASE BOUNDARY | Phase 7B does NOT create projects or execute Phase 8A handovers. |

---

## 3. Supersession & Contradiction Audit Findings

A complete search across documentation, migrations, and source code confirmed:
1. **Approval Workflow Exclusions**:
   - `quotations.approve` permission: **0 active occurrences** in database or application code (`18_quotation_draft_foundation_test.sql` explicitly asserts `quotations.approve` does NOT exist).
   - Approval states (`Submitted for Approval`, `Approved`): Historical references in ADR-0020 explicitly marked superseded by ADR-0022.
2. **Direct WhatsApp Outbound Exclusions**:
   - All WhatsApp outbound interactions in the codebase route exclusively through `src/features/whatsapp/server/`. Quotation feature code contains zero direct Meta Graph API fetch calls.

---

## 4. Locked Pre-Existing Rules

1. **NO Internal Approval**: V1 quotation lifecycle operates as: `Draft` → `Finalized` → `Sent` → `Accepted / Closed-Won` / `Revised`. No `quotations.approve` permission or approval table shall be created.
2. **V1 Sales Authority Model**:
   - Super Admin possesses full commercial administrative scope.
   - Sales Manager possesses broad authorized sales scope across all sales leads.
   - Active Sales Executive possesses assigned lead scope for currently assigned leads.
3. **Server-Authoritative Finalization**: Transactional freezing of quotation draft into an immutable `finalized` version with a SHA-256 canonical content digest.
4. **Hard Discount & Tax Boundary**:
   - Hard maximum discount percentage is configured by Super Admin (production value remains UNSET).
   - Tax profile catalogue is configured by Super Admin (production value remains UNSET; no fake default GST).
   - Finalization snapshot freezes selected tax profile rates into the version record.
5. **Payment Schedule Absorption**: Last ordered milestone in percentage schedule absorbs residual paise to guarantee `sum(milestones) == grand_total_paise`.
6. **Unique Lead Cardinality**: Exactly 1 quotation root per lead (`quotations.lead_id` UNIQUE).
7. **Secure Non-Enumerating Client Capability**: Acceptance portal accessed via high-entropy token (`/q/[token]`). Tokens map to exact finalized version.
8. **Client Acceptance Atomically Drives Closed-Won**: Dedicated client acceptance path atomically transitions associated CRM lead to `Closed-Won`, snapshots `credited_sales_executive_id` at the acceptance instant, interprets `accepted_at` in `Asia/Kolkata`, and uses `taxable_base_paise` (GST excluded) as the sales achievement basis.

---

## 5. Phase 7B V1 Actor & RBAC Matrix

| Actor Role | View Finalized / PDF | Draft / Revision Mutate | Finalize Version | Send Delivery | Revoke Token | Accept as Client |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | ✅ Full Administrative Scope | ✅ Full Scope (`quotations.edit`) | ✅ Full Scope (`quotations.finalize`) | ✅ Full Scope (`quotations.send`) | ✅ Full Scope | ❌ FORBIDDEN |
| **Sales Manager** | ✅ Broad Sales Scope | ✅ Broad Sales Scope (`quotations.edit`) | ✅ Broad Sales Scope (`quotations.finalize`) | ✅ Broad Sales Scope (`quotations.send`) | ✅ Broad Sales Scope | ❌ FORBIDDEN |
| **Assigned Sales Exec** | ✅ Assigned Lead | ✅ Assigned Lead (`quotations.edit`) | ✅ Assigned Lead (`quotations.finalize`) | ✅ Assigned Lead (`quotations.send`) | ✅ Assigned Lead | ❌ FORBIDDEN |
| **Non-assigned Sales Exec** | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN |
| **Project Manager (PM)** | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN |
| **Designer** | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN |
| **Kriti (AI Copilot)** | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN |
| **Client Capability Holder** | ✅ Exact Version via Token | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ❌ FORBIDDEN | ✅ Exact Version (`/q/[token]`) |

---

## 6. Domain State & Lifecycle Model

```
 +------------------+           Finalize RPC          +----------------------+
 |   DRAFT (v1)     | -----------------------------> |   FINALIZED (v1)     |
 | (Mutable Draft)  |  (quotations.finalize)         | (Immutable Version)  |
 +------------------+                                +----------------------+
          ^                                                     |
          | Pre-Acceptance Revision                             | Generate PDF & Send
          | (quotations.edit)                                   v (quotations.send)
 +------------------+                                +----------------------+
 |   DRAFT (v2)     |                                |  SENT / DELIVERED    |
 | (Mutable Draft)  |                                | (Client Capability)  |
 +------------------+                                +----------------------+
                                                                |
                                                                | Client Accept (/q/[token])
                                                                v (Atomic Transaction)
                                                     +----------------------+
                                                     | CLIENT ACCEPTED &    |
                                                     | CRM CLOSED-WON       |
                                                     | (Credited Exec Snap) |
                                                     +----------------------+
                                                                |
                                                                | Phase 8A Only
                                                                v (Post-Closed-Won)
                                                     +----------------------+
                                                     | PROJECT CREATION &   |
                                                     | PM HANDOVER EXEC     |
                                                     +----------------------+
```

---

## 7. Server-Authoritative Finalization Contract

The finalization transaction must be server/database-authoritative and execute the following atomic steps:
1. **Identity & RBAC Check**: Verify active staff actor possesses `quotations.finalize` and operates within authorized scope (Super Admin full scope, Sales Manager broad sales scope, or active Sales Executive assigned lead scope).
2. **Target Lock & State Check**: Lock the target quotation root and verify target version status is active `draft`. Enforce optimistic concurrency check on `lock_version`.
3. **Monetary Totals Re-Calculation**: Server-side re-calculation of line item totals, section subtotals, subtotal paise, quotation discount, taxable base paise, tax total paise, and grand total paise in integer INR paise.
4. **Discount & Tax Bounds Validation**: Reject finalization if quotation discount exceeds Super-Admin hard maximum discount bound or if required production tax profile configuration is missing.
5. **Schedule Residual Absorption**: For percentage payment schedules, last ordered milestone absorbs residual paise to ensure `sum(milestone_amounts) == grand_total_paise`.
6. **Deterministic Content SHA-256 Digest**: Compute `finalized_content_sha256` over the canonical JSON representation of the frozen commercial payload.
7. **Freeze & Audit**: Mark version status `finalized`, set `finalized_at` and `finalized_by`, append `quotation.finalized` audit event.

---

## 8. Canonical Content Hash vs. PDF Binary Hash

Phase 7B explicitly distinguishes between two distinct SHA-256 digests:
- **`finalized_content_sha256`**: The SHA-256 digest computed over the canonical JSON serialization of the frozen commercial data payload (semantic snapshot digest).
- **`pdf_sha256`**: The SHA-256 digest computed over the exact binary bytes of the rendered PDF document (binary artifact digest).

---

## 9. Premium PDF Artifact & Storage Contract

- **Storage Bucket**: Private Supabase Storage bucket `quotation-documents` (0 public listing, 0 unauthenticated permanent URLs).
- **Two-Boundary Execution**: Database finalization commits the commercial snapshot FIRST. PDF rendering and upload occur as an idempotent server-side artifact step. Storage failure does NOT roll back database finalization; PDF generation can be safely retried.
- **Access Model**: PDF delivered to client via short-lived signed URLs (15-minute TTL) generated on-demand by the client portal server endpoint after capability validation.
- **Fidelity**: Generated once per finalized version, hashed (`pdf_sha256`), and stored immutably. Byte-changing overwrite of an existing verified PDF artifact is prohibited.

---

## 10. Client Capability & Token Security Contract

1. **Token Generation**: Cryptographically random, high-entropy token (32+ bytes hex/base64url).
2. **One-Way Hashing**: Plaintext token transmitted ONLY in client URL (`/q/[token]`). Database stores only `capability_token_hash` = `sha256(plaintext_token)`.
3. **Log Protection**: Plaintext token MUST NEVER be written to database tables, application logs, error traces, audit events, or analytics.
4. **Non-Enumerating Error Handling**: Invalid or revoked token requests return generic non-enumerating error `QUOTATION_NOT_FOUND_OR_FORBIDDEN`.
5. **Privacy Protection**: Client IP address MUST NOT be logged or stored. User-Agent is retained as bounded audit metadata.
6. **Pre-Acceptance Token Revocation**: Creating a new draft revision automatically revokes active capability tokens for previous unaccepted versions.

---

## 11. Client Acceptance & Atomic Closed-Won Contract

Per ADR-0022 §6, client acceptance is an authoritative transactional operation that atomically drives CRM lead transition to `Closed-Won`:

1. **Capability Validation**: Validates the opaque client capability token (`/q/[token]`) and maps to the exact finalized quotation version.
2. **Quotation Root Lock**: Transactionally locks the quotation root, target version, and CRM lead records.
3. **Acceptance Uniqueness**: Enforces exactly 1 authoritative accepted quotation version per lead (`quotation_acceptances.quotation_id` UNIQUE across all versions).
4. **Snapshot Credited Sales Executive**: Transactionally snapshots `credited_sales_executive_id` at the acceptance instant (`public.leads.assigned_to` of the lead at acceptance time).
5. **Achievement Time Zone**: Interprets `accepted_at` in the `Asia/Kolkata` time zone to determine the authoritative sales achievement month.
6. **Atomic Closed-Won Stage Transition**: Transactionally mutates the CRM lead stage to `Closed-Won` in the SAME database transaction as client acceptance.
7. **Sales Achievement Basis**: Uses `taxable_base_paise` (GST excluded) as the authoritative sales revenue achievement figure.
8. **Idempotency**: Repeated acceptance submission of the SAME exact accepted version returns a successful idempotent response without re-triggering stage changes or creating duplicate rows.
9. **Phase 8A Boundary**: Client acceptance and atomic Closed-Won transition do NOT create Phase 8A projects or trigger handover execution. Project creation remains strictly in Phase 8A.

---

## 12. Pre-Acceptance Revision Contract

- Revisions may be created ONLY while no quotation version for the lead has been accepted.
- Creating a revision increments version ordinal (`OD-Q-YYYY-SEQ6` v1 -> v2) under the same quotation root.
- Historical finalized versions remain immutable.
- Active capability tokens for unaccepted prior versions are automatically revoked upon revision creation.

---

## 13. Post-Acceptance Commercial Stability & Future Change Orders (Locked OD7B-5)

> [!IMPORTANT]
> **Locked OD7B-5 Rule**: Once a quotation version has been client-accepted and forms the Closed-Won commercial baseline, that accepted baseline is permanent and immutable. Phase 7B V1 prohibits ordinary quotation revision creation after acceptance. Any later commercial changes belong to a separate future Change Order / Commercial Amendment workflow (outside Phase 7B V1) that preserves the original accepted quotation and its historical sales/handover baseline.

---

## 14. WhatsApp Delivery & Phase 6B Boundary

- All quotation WhatsApp deliveries MUST route through the existing Phase 6B `WHATSAPP_SERVICE` outbound intent system (`src/features/whatsapp/server/`).
- Direct Meta Graph API fetch calls from quotation feature code are strictly prohibited.
- Outbound payload contains secure portal link `/q/[token]`, never a public PDF URL.
- Distinct transport states: `FINALIZED` → `PDF_READY` → `SEND_REQUESTED` / `QUEUED` → `PROVIDER_SENT` / `DELIVERED` (via Phase 6B webhook) → `ACCEPTED & CLOSED-WON`.

---

## 15. Concurrency, Idempotency & Failure Matrix

| Operation | Concurrent Request / Replay | Failure Mode | Idempotent / Safe Outcome |
| :--- | :--- | :--- | :--- |
| **Finalize** | Concurrent draft edit vs finalize | Stale `lock_version` or non-draft status | Replayed request returns same finalized snapshot; concurrent edit rejected. |
| **PDF Render** | Repeated generation trigger | Storage network timeout / render crash | Finalized DB snapshot preserved; retry completes missing artifact. Verified PDF never overwritten. |
| **Send** | Duplicate send button click / timeout | Outbound queue error | Enqueues exactly 1 Phase 6B intent; retry returns existing intent ID. |
| **Client Accept** | Double-click accept / page refresh | Invalid / revoked capability token | Replayed accept returns existing acceptance record and Closed-Won state; invalid token returns non-enumerating error. |

---

## 16. Append-Only Audit Event Contract

Future Phase 7B implementation will record the following append-only commercial audit events in `public.quotation_events`:
- `quotation.finalized`: Finalized version SHA-256 digest, actor ID, timestamp.
- `quotation.pdf_generated`: PDF artifact path, PDF SHA-256, file size.
- `quotation.send_requested`: Phase 6B outbound intent ID, recipient phone (masked/sanitized), version ID.
- `quotation.capability_issued`: Version ID, capability grant ID, expiration timestamp.
- `quotation.capability_revoked`: Grant ID, revocation reason, revoking actor ID.
- `quotation.accepted`: Version ID, accepted name/email, timestamp, credited sales executive ID, atomic Closed-Won marker (0 raw IP).
- `quotation.revision_created`: Source version ID, new version ID, actor ID.

---

## 17. Conceptual Forward-Only M26 Schema Plan (No M26 Created in this Gate)

> [!NOTE]
> The following schema extensions are conceptual for future forward-only migration M26:
> - Extend `public.quotation_versions` with `status` (`draft` | `finalized` | `archived`), `finalized_at`, `finalized_by`, `finalized_content_sha256`, `tax_profile_snapshot`.
> - Create `public.quotation_pdf_documents` for PDF artifact metadata (`bucket_id`, `file_path`, `file_size_bytes`, `pdf_sha256`, `status`).
> - Create `public.quotation_access_grants` for token capability hashes (`capability_token_hash` UNIQUE, `expires_at`, `revoked_at`).
> - Create `public.quotation_acceptances` for client acceptance records (`quotation_id` UNIQUE per lead, `version_id`, `accepted_by_name`, `accepted_by_email`, `accepted_at`, `credited_sales_executive_id`).
> - System permissions: `quotations.finalize`, `quotations.send`.

---

## 18. Locked Phase 7B Architecture Decisions (OD7B-1 through OD7B-6)

> [!IMPORTANT]
> **Owner Authorization Received**: `LOCK PHASE 7B OWNER DECISIONS AS RECOMMENDED`. All 6 architecture decisions below are formally LOCKED. Final exact PR head and exact-head CI run are recorded in PR #54 body after push.

### Decision OD7B-1: Client Acceptance Capability Token Expiry Policy
- **Status**: **LOCKED**
- **Lock Wording**: *"Client acceptance capability tokens remain active for the finalized version until a new revision is issued or the token is explicitly revoked by authorized staff."*

### Decision OD7B-2: Token Revocation on Pre-Acceptance Revision Creation
- **Status**: **LOCKED**
- **Lock Wording**: *"Creating a new pre-acceptance quotation revision automatically revokes client acceptance capability for all previous unaccepted versions of that quotation."*

### Decision OD7B-3: Premium PDF Storage & Delivery Access Model
- **Status**: **LOCKED**
- **Lock Wording**: *"Quotation PDF documents are stored in private bucket quotation-documents and delivered via short-lived signed URLs generated on-demand through valid capability sessions."*

### Decision OD7B-4: PDF Immutable Caching & Content Hashing Policy
- **Status**: **LOCKED**
- **Lock Wording**: *"Quotation PDFs are generated once per finalized version, hashed, and stored immutably. Re-rendering of existing finalized versions is prohibited."*

### Decision OD7B-5: Post-Acceptance Commercial Stability & Future Change Orders
- **Status**: **LOCKED**
- **Lock Wording**: *"After client acceptance, the accepted quotation version remains the permanent authoritative Closed-Won commercial baseline. Phase 7B V1 prohibits creation of an ordinary quotation revision after acceptance. Any later commercial change must be represented by a separate future Change Order / Commercial Amendment workflow that preserves the original accepted quotation and its historical sales/handover baseline."*

### Decision OD7B-6: Commercial Authority Matrix & Permission Split
- **Status**: **LOCKED**
- **Lock Wording**: *"Phase 7B commercial authority follows the locked V1 sales scope model: Super Admin has full commercial administrative scope; Sales Manager has broad authorized sales scope; and an active Sales Executive may mutate/finalize/send only quotations for leads currently assigned to that executive. Draft/revision mutation requires quotations.edit, finalization requires quotations.finalize, and delivery requires quotations.send. PM, Designer, and Kriti have zero quotation mutation/finalize/send authority. No quotations.approve or staff quotations.accept capability exists."*

---

## 19. Quality Gate Verification

Local verification on entry branch `phase-7b-architecture-entry`:
- **Phase 7A Unit Tests (`npm run test:phase-7a`)**: 42/42 PASS
- **Database Quality Gate (`npm run check:db`)**: 748/748 PASS (94/94 in `18_quotation_draft_foundation_test.sql`)
- **All Application Unit Tests (`npm run test:app`)**: 593/593 PASS across 156 test suites
- **Application Quality Gate (`npm run check`)**: 0 lint errors, 11 warnings, 0 type errors, Next.js build SUCCESS
- **Git Hygiene (`git diff --check`)**: Clean (0 issues)

---

## 20. Managed Write Ledger

```text
MANAGED_READS: YES
MANAGED_SCHEMA_WRITE: NONE
MANAGED_DATA_WRITE: NONE
MANAGED_MIGRATION_WRITE: NONE
MANAGED_RESTORE: NONE
```

---

## 21. Exit Classification

```text
PHASE_7B_ARCHITECTURE_ENTRY: PASS
PHASE_7B_ARCHITECTURE_STATUS: FROZEN / OWNER_DECISIONS_LOCKED
OWNER_DECISIONS_REMAINING: ZERO
NEXT_OWNER_ACTION: PROCEED PHASE 7B PR54 MERGE
```
