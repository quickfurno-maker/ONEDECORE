# Phase 5D — Bulk Import Approval & Source-Based Assignment Closeout

**Audit state:** COMPLETE (closeout truth-sync)  
**Date:** August 3, 2026  
**Implementation merge:** protected main PR #13 — `4609b8f63ddfdd15f6d6959daa103813cb357fe1`  
**Migration 15:** `20260802140000_crm_bulk_import_source_assignment_foundation.sql`  
**M15 SHA-256:** `A089E478EB28BEA7FFBAB44283C391650052F1A9F64DF9E4AE9D0E15DA87F088`  
**Managed project:** OneDecore (`lpurlfmpvriyvpkujvyl`, ap-south-1)

---

## A. Baseline

| Item | Value |
| :--- | :--- |
| Phase 5C | COMPLETE |
| Implementation PR | #13 on protected main |
| Implementation merge SHA | `4609b8f63ddfdd15f6d6959daa103813cb357fe1` |
| Managed apply | Phase DB-4B — August 3, 2026 |
| Managed migration alignment | **M1–M15** |

---

## B. Delivered functional scope

- CSV/XLSX import batches with mapping, validation, and preview
- Sales Manager submit → Super Admin approval workflow
- Super Admin direct import path (`approval_kind=direct_import`)
- Manager self-approval blocked at database layer
- Source-based assignment rules with deterministic resolution
- Specificity DESC → priority ASC → id ASC ordering
- Unassigned fallback when no rule match or ineligible target
- No round-robin, counters, weights, or modulo assignment
- Bounded, idempotent `process_lead_import_batch` processor (max 100 rows/call)
- Duplicate-safe integration with Phase 5C2B/M14 semantics
- Metadata-only file persistence (filename, SHA-256, type, size, worksheet) — no raw blob storage

---

## C. Role / permission contract

| Permission | Granted roles |
| :--- | :--- |
| `leads.bulk_import` | `super_admin`, `sales_manager`, `management` |
| `leads.bulk_import_approve` | `super_admin` only |
| `leads.assignment_rules.manage` | `super_admin` only |

**Denied (no grants):** `sales_executive`, `sales`, `project_manager`, `designer`, `project_operations` for approval and rules management.

Import batch visibility: Super Admin broad; Sales Manager / legacy management own batches only; executives and other operational roles none.

---

## D. Import semantics

| Field | Value |
| :--- | :--- |
| `leads.entry_method` | `import` |
| `leads.source` (transport) | `bulk-import` |
| `leads.primary_source_id` | Mapped business `lead_sources` row |
| `lead_assignment_history.assignment_method` | `source_rule` (bulk import only) |
| Activity | `lead.bulk_imported` |
| Consent | No fabricated consent; no marketing consent from import |

---

## E. Duplicate policy

**Importable:** `CLEAR`, `REUSABLE_CONTACT`  
**Blocked:** `ACTIVE_DUPLICATE`, `RECENT_SIMILAR`, `CONTACT_IDENTITY_CONFLICT`  
**No bulk override.** Per-row transactional duplicate recheck at import time.

---

## F. Assignment contract

- Source required; service/locality/budget optional
- Specificity DESC → priority ASC → id ASC
- Target revalidated at import; ineligible → Unassigned
- No alternate/random target; no round-robin
- `crm_resolve_lead_assignment_rule` applies to **bulk-import only** (not manual/public intake)

---

## G. QA evidence (implementation)

| Suite | Result |
| :--- | :--- |
| Application | 418/418 |
| Image | 17/17 |
| Database (pgTAP) | 434/434 |
| Owner QA | 24/24 |
| Browser QA | 32/32 |

**XLSX H1 correction:** Header mapping mismatch corrected before protected-main merge.

---

## H. Managed apply (DB-4B)

| Item | Value |
| :--- | :--- |
| Apply window (UTC) | 2026-08-03T04:44:02Z – 04:44:08Z |
| Mechanism | `npx supabase db push --linked --yes` |
| Result | SUCCESS |
| Post-apply migrations | M1–M15 aligned |
| Post dry-run | Up to date |
| Managed lint | PASS |
| Security Advisor | No issues |
| Performance Advisor | INFO/nonblocking only |
| Synthetic managed business rows | None created |

Permission delta (expected): permissions 23→26 (+3); role_permissions 74→79 (+5).

---

## I. Recovery exception (DB-4A-X)

**Normal gate:** Phase DB-4A required a post-M14 completed physical backup.  
**Observed:** Newest scheduled physical backup remained `2026-08-01T19:54:53.794Z` (pre-M14).

**One-time owner-approved M15 exception (DB-4A-X):**

1. Fresh logical managed dump captured (roles/schema/data)
2. SHA-256 frozen
3. Isolated local restore verified
4. Schema, RBAC, functions, and row counts compared

| File | SHA-256 |
| :--- | :--- |
| roles.sql (370 B) | `168A95A9C745AF5ED4679751F90419AC9DC434240A213B03E32A06D5664C2308` |
| schema.sql (193,980 B) | `D114E712474CD7E1675E09E1FF444AE602C16E4E2DBD29563C0B9891D2E3F288` |
| data.sql (46,974 B) | `3DFF826F169D397F68F627CE72C418FA76CE38E1327E9F4EDDF2D7D6177D2C50` |

Capture window: 2026-08-03T03:51:37Z – 03:51:56Z. Recovery package preserved locally outside Git.

**Important:** Logical backup ≠ managed physical backup. Exception applies to **M15 only**. **M16+** resumes normal managed physical-backup gate unless owner explicitly changes policy.

**Operational follow-up:** Supabase support escalation recommended for delayed scheduled physical backups (`lpurlfmpvriyvpkujvyl`, ap-south-1).

---

## J. Non-actions

- No production deployment
- Public intake not activated (`copy-only` / `disabled` defaults)
- No Closed-Won activation (blocked until Phase 7B)
- No Phase 5E implementation
- No WhatsApp / campaigns
- No production synthetic leads
- No raw import file persistence on managed database

---

## K. Exit gate

**Phase 5D is COMPLETE** when this closeout PR merges to protected main.

**Next implementation phase:** Phase 5E-B (Sales Targets & CRM Reporting) — not started until closeout merge and owner authorization.

**Related audits:** [Phase 5D implementation audit](phase-5d-bulk-import-source-assignment.md) (historical local implementation record).
