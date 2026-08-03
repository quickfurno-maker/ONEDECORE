# Phase 5D — Bulk Import & Source-Based Assignment (Implementation Record)

**Historical note:** This document records the **local implementation** phase. For authoritative closeout evidence (managed M15 apply, DB-4A-X recovery exception, exit gate), see [Phase 5D Closeout](phase-5d-bulk-import-source-assignment-closeout.md).

**Implementation date:** August 2, 2026
**Migration:** 15 — `20260802140000_crm_bulk_import_source_assignment_foundation.sql`

---

## 1. Scope

Phase 5D adds staged bulk lead import with manager submission / super-admin approval, direct super-admin import, and source-based assignment rules resolved during validation.

### Owner corrections (locked)

| Field | Value |
| :--- | :--- |
| `leads.entry_method` | `import` |
| `leads.source` | `bulk-import` |

---

## 2. Database surface (migration 15)

### Permissions

- `leads.bulk_import` — super_admin, sales_manager, management
- `leads.bulk_import_approve` — super_admin only
- `leads.assignment_rules.manage` — super_admin only

### Public RPCs

| RPC | Purpose |
| :--- | :--- |
| `create_lead_import_batch` | Idempotent batch creation |
| `replace_lead_import_mapping` | Column mapping + default source |
| `replace_lead_import_rows` | Replace staged rows (1–1000) |
| `validate_lead_import_batch` | Row validation + assignment resolution |
| `submit_lead_import_batch` | Manager submission |
| `approve_lead_import_batch` | Super-admin approval (not creator) |
| `reject_lead_import_batch` | Super-admin rejection |
| `confirm_lead_import_batch_direct` | Super-admin direct confirm |
| `cancel_lead_import_batch` | Cancel non-terminal batch |
| `process_lead_import_batch` | Chunked import execution |
| `create_lead_assignment_rule` | Create rule |
| `update_lead_assignment_rule` | Update rule |
| `set_lead_assignment_rule_active` | Enable/disable rule |

---

## 3. Application layer

### Contracts

- `lead-import-contracts.ts` — statuses, limits, mapping keys, DTOs
- `assignment-rule-contracts.ts` — rule DTOs and validation

### Server

- `lead-import-file-parser.ts` — CSV (UTF-8 BOM) + XLSX (formula rejection), 5 MiB / 1000 rows / 50 cols
- `crm-import-service.ts`, `crm-import-queries.ts`, `crm-import-actions.ts`
- `crm-assignment-rule-service.ts`, `crm-assignment-rule-actions.ts`
- Extended `crm-errors.ts`, `crm-permissions.ts`, `crm-access.ts`, `crm-auth.ts`

### UI routes

| Route | Access |
| :--- | :--- |
| `/admin/crm/imports` | `leads.bulk_import` |
| `/admin/crm/imports/new` | `leads.bulk_import` |
| `/admin/crm/imports/[batchId]` | batch visibility RPC |
| `/admin/crm/settings/assignment-rules` | `leads.assignment_rules.manage` |

---

## 4. Local QA (implementation)

| Suite | Result |
| :--- | :--- |
| Application | 418/418 |
| Image | 17/17 |
| Database | 434/434 |
| Owner QA | 24/24 |
| Browser QA | 32/32 |

XLSX H1: header mapping mismatch corrected before merge.

---

## 5. Status at implementation merge

Application merged to protected main (PR #13). Managed migration 15 applied separately via Phase DB-4B (August 3, 2026). See closeout audit for managed evidence.
